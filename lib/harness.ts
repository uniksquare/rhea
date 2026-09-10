import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HarnessResult, HarnessUsage } from "@/lib/assignment-types";

const execFileAsync = promisify(execFile);

/**
 * Server-side tool ceiling. Tenant config can narrow this list but never
 * widen it: Bash, WebFetch, etc. are never granted to a tenant-driven run.
 */
export const SAFE_TOOLS = ["Read", "Edit", "MultiEdit", "Write", "Glob", "Grep"] as const;
const DEFAULT_MAX_TURNS = 25;
const SDK_SPECIFIER = "@anthropic-ai/claude-agent-sdk";

/**
 * Env allowlist for the child process. The child must not inherit app
 * secrets (DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY, ...); only the basics
 * plus LLM provider auth are forwarded.
 */
const CHILD_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "SHELL",
  "USER",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLOUD_ML_REGION",
  "ANTHROPIC_VERTEX_PROJECT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CLAUDE_MODEL",
] as const;

function childEnv(): NodeJS.ProcessEnv {
  // Cast: Next augments ProcessEnv with a required NODE_ENV, which we
  // deliberately do not forward.
  const env = {} as NodeJS.ProcessEnv;
  for (const key of CHILD_ENV_ALLOWLIST) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }
  return env;
}

function effectiveTools(requested: string[] | undefined): string[] {
  const base = requested?.length ? requested : [...SAFE_TOOLS];
  const safe = new Set<string>(SAFE_TOOLS);
  const tools = base.filter((t) => safe.has(t));
  return tools.length ? tools : [...SAFE_TOOLS];
}

type RawUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

type RawResult = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  errors?: string[];
  session_id?: string;
  total_cost_usd?: number;
  usage?: RawUsage;
  modelUsage?: Record<string, unknown>;
};

function mapUsage(u: RawUsage | undefined, costUsd: number | undefined): HarnessUsage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    costUsd: costUsd ?? 0,
  };
}

function truthy(v: string | undefined): boolean {
  return !!v && v !== "0" && v.toLowerCase() !== "false";
}

function provider(): HarnessResult["provider"] {
  if (truthy(process.env.CLAUDE_CODE_USE_VERTEX)) return "vertex";
  // TODO: add "bedrock" to HarnessResult["provider"] in lib/assignment-types.ts; until then Bedrock runs report "anthropic" (raw is passed through unchanged).
  if (truthy(process.env.CLAUDE_CODE_USE_BEDROCK)) return "anthropic";
  return "anthropic";
}

function toResult(raw: RawResult, requestedModel: string | undefined): HarnessResult {
  const ok = raw.type === "result" && raw.subtype === "success" && !raw.is_error;
  const output =
    raw.result ??
    (raw.errors?.length ? raw.errors.join("\n") : `harness ended: ${raw.subtype ?? "unknown"}`);
  const usedModel = raw.modelUsage ? Object.keys(raw.modelUsage)[0] : undefined;
  return {
    ok,
    output,
    sessionId: raw.session_id,
    usage: mapUsage(raw.usage, raw.total_cost_usd),
    provider: provider(),
    model: requestedModel ?? usedModel ?? "default",
    raw,
  };
}

type RunOpts = {
  workspacePath: string;
  prompt: string;
  allowedTools: string[];
  model?: string;
  maxTurns: number;
  env: NodeJS.ProcessEnv;
};

async function runViaSdk(opts: RunOpts): Promise<HarnessResult> {
  // Non-literal specifier so the module resolves at runtime only; a missing
  // package throws here and the caller falls back to the CLI.
  const sdk = (await import(/* webpackIgnore: true */ SDK_SPECIFIER)) as {
    query: (params: { prompt: string; options?: Record<string, unknown> }) => AsyncIterable<RawResult>;
  };
  const q = sdk.query({
    prompt: opts.prompt,
    options: {
      cwd: opts.workspacePath,
      allowedTools: opts.allowedTools,
      permissionMode: "acceptEdits",
      maxTurns: opts.maxTurns,
      env: opts.env,
      ...(opts.model ? { model: opts.model } : {}),
    },
  });
  let last: RawResult | undefined;
  for await (const msg of q) {
    if (msg?.type === "result") last = msg;
  }
  if (!last) throw new Error("harness: SDK query ended without a result message");
  return toResult(last, opts.model);
}

async function runViaCli(opts: RunOpts): Promise<HarnessResult> {
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "json",
    "--allowedTools",
    opts.allowedTools.join(","),
    "--permission-mode",
    "acceptEdits",
  ];
  // Note: the installed `claude` CLI has no --max-turns flag, so maxTurns is
  // only enforced on the SDK path.
  if (opts.model) args.push("--model", opts.model);

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("claude", args, {
      cwd: opts.workspacePath,
      maxBuffer: 20 * 1024 * 1024,
      env: opts.env,
    }));
  } catch (err) {
    const e = err as { stdout?: string; message?: string };
    // The CLI exits non-zero on error results but still prints JSON.
    if (e.stdout && e.stdout.trim().startsWith("{")) {
      stdout = e.stdout;
    } else {
      throw new Error(`harness: claude CLI failed: ${e.message ?? String(err)}`);
    }
  }
  let raw: RawResult;
  try {
    raw = JSON.parse(stdout) as RawResult;
  } catch {
    throw new Error("harness: could not parse claude CLI JSON output");
  }
  return toResult(raw, opts.model);
}

/**
 * Run Claude Code headless, scoped to `workspacePath`.
 *
 * Uses the Agent SDK `query()` when `@anthropic-ai/claude-agent-sdk` is
 * installed; otherwise spawns `claude -p ... --output-format json`.
 *
 * The child gets a minimal allowlisted env (see CHILD_ENV_ALLOWLIST), never
 * the full process.env. `allowedTools` is intersected with SAFE_TOOLS, so
 * tenant config can only narrow the tool set. Env honored:
 * CLAUDE_CODE_USE_VERTEX (reports provider "vertex"), CLAUDE_CODE_USE_BEDROCK,
 * plus whatever the SDK/CLI reads for auth. Secrets are never logged.
 */
export async function runHarness(opts: {
  workspacePath: string;
  prompt: string;
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
}): Promise<HarnessResult> {
  const normalized: RunOpts = {
    workspacePath: opts.workspacePath,
    prompt: opts.prompt,
    allowedTools: effectiveTools(opts.allowedTools),
    model: opts.model,
    maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
    env: childEnv(),
  };
  try {
    return await runViaSdk(normalized);
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    const importFailed =
      (err as { code?: string })?.code === "ERR_MODULE_NOT_FOUND" ||
      /Cannot find (module|package)/i.test(msg);
    if (!importFailed) throw err;
    return runViaCli(normalized);
  }
}
