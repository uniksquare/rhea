import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HarnessResult, HarnessUsage } from "@/lib/assignment-types";

const execFileAsync = promisify(execFile);

const DEFAULT_ALLOWED_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"];
const DEFAULT_MAX_TURNS = 25;
const SDK_SPECIFIER = "@anthropic-ai/claude-agent-sdk";

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

function provider(): HarnessResult["provider"] {
  const v = process.env.CLAUDE_CODE_USE_VERTEX;
  return v && v !== "0" && v.toLowerCase() !== "false" ? "vertex" : "anthropic";
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

async function runViaSdk(opts: {
  workspacePath: string;
  prompt: string;
  allowedTools: string[];
  model?: string;
  maxTurns: number;
}): Promise<HarnessResult> {
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

async function runViaCli(opts: {
  workspacePath: string;
  prompt: string;
  allowedTools: string[];
  model?: string;
  maxTurns: number;
}): Promise<HarnessResult> {
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
      env: process.env,
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
 * Env honored: CLAUDE_CODE_USE_VERTEX (reports provider "vertex"), plus
 * whatever the SDK/CLI reads for auth (ANTHROPIC_API_KEY, or Vertex ADC with
 * CLOUD_ML_REGION / ANTHROPIC_VERTEX_PROJECT_ID). Secrets are never logged.
 */
export async function runHarness(opts: {
  workspacePath: string;
  prompt: string;
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
}): Promise<HarnessResult> {
  const normalized = {
    workspacePath: opts.workspacePath,
    prompt: opts.prompt,
    allowedTools: opts.allowedTools?.length ? opts.allowedTools : DEFAULT_ALLOWED_TOOLS,
    model: opts.model,
    maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
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
