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

export type HarnessEngine = "sdk" | "cli";
export type HarnessBilling = "api" | "subscription";

/**
 * Model used when the caller passes none. Without an explicit `--model` the
 * CLI/SDK falls back to its own default (currently Opus), which is the most
 * expensive option; `RHEA_HARNESS_DEFAULT_MODEL` overrides the built-in
 * Sonnet default. Pure; exported for tests.
 */
export const BUILT_IN_DEFAULT_MODEL = "claude-sonnet-4-5";
export function resolveModel(requested: string | undefined, env: NodeJS.ProcessEnv): string {
  const r = requested?.trim();
  if (r) return r;
  const d = env.RHEA_HARNESS_DEFAULT_MODEL?.trim();
  return d || BUILT_IN_DEFAULT_MODEL;
}

/**
 * How a run is billed: "subscription" when the child authenticates with the
 * operator's Claude plan (RHEA_HARNESS_AUTH=subscription), "api" otherwise.
 * Pure; exported for tests.
 */
export function harnessBilling(env: NodeJS.ProcessEnv): HarnessBilling {
  return usesSubscriptionAuth(env) ? "subscription" : "api";
}

/**
 * Cost to record for a run. Subscription runs are not metered, so the
 * reported dollar figure is nominal and must not be charged: it is zeroed
 * here (callers can still read it from `raw.nominalCostUsd`). Pure; exported
 * for tests.
 */
export function chargeableCost(costUsd: number | undefined, billing: HarnessBilling): number {
  if (billing === "subscription") return 0;
  return costUsd ?? 0;
}

/**
 * Pick the engine from the environment. `RHEA_HARNESS_ENGINE=cli` spawns the
 * installed `claude` binary directly (so the operator's Claude Max login is
 * used); anything else defaults to the Agent SDK. Pure; exported for tests.
 */
export function selectEngine(env: NodeJS.ProcessEnv): HarnessEngine {
  const v = env.RHEA_HARNESS_ENGINE?.trim().toLowerCase();
  return v === "cli" || v === "sdk" ? v : "sdk";
}

/**
 * True when the run should authenticate with the operator's Claude
 * subscription (CLI login) rather than an API key. Pure; exported for tests.
 */
export function usesSubscriptionAuth(env: NodeJS.ProcessEnv): boolean {
  return env.RHEA_HARNESS_AUTH?.trim().toLowerCase() === "subscription";
}

/**
 * Build the allowlisted child env from `source`. With subscription auth the
 * API key is dropped so the CLI falls back to its stored login. Pure;
 * exported for tests.
 */
export function buildChildEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Cast: Next augments ProcessEnv with a required NODE_ENV, which we
  // deliberately do not forward.
  const env = {} as NodeJS.ProcessEnv;
  const subscription = usesSubscriptionAuth(source);
  for (const key of CHILD_ENV_ALLOWLIST) {
    if (subscription && key === "ANTHROPIC_API_KEY") continue;
    const v = source[key];
    if (v !== undefined) env[key] = v;
  }
  return env;
}

function childEnv(): NodeJS.ProcessEnv {
  return buildChildEnv(process.env);
}

/** Tools a read-only (planning) run may use. Strict subset of SAFE_TOOLS. */
export const READ_ONLY_TOOLS = ["Read", "Glob", "Grep"] as const;

/**
 * Tools that are always denied. `allowedTools` only pre-approves; it does not
 * block anything, so the deny list is what actually keeps the model from
 * running Bash or reaching the network.
 */
export const ALWAYS_DISALLOWED_TOOLS = ["Bash", "WebFetch", "WebSearch"] as const;

/** Additional denies for read-only runs: every mutating built-in. */
export const READ_ONLY_DISALLOWED_TOOLS = ["Edit", "MultiEdit", "Write", "NotebookEdit"] as const;

function effectiveTools(requested: string[] | undefined): string[] {
  const base = requested?.length ? requested : [...SAFE_TOOLS];
  const safe = new Set<string>(SAFE_TOOLS);
  const tools = base.filter((t) => safe.has(t));
  return tools.length ? tools : [...SAFE_TOOLS];
}

/**
 * Resolve the allow/deny tool lists for a run. Pure; exported for tests.
 *
 * - `allowed` is `allowedTools` intersected with SAFE_TOOLS (default: all of
 *   SAFE_TOOLS), and further intersected with READ_ONLY_TOOLS when `readOnly`.
 * - `disallowed` always contains ALWAYS_DISALLOWED_TOOLS, plus every mutating
 *   tool when `readOnly`, plus whatever the caller passes in `disallowedTools`.
 *   Anything in `disallowed` is removed from `allowed` so the two never overlap.
 */
export function resolveToolPolicy(opts: {
  allowedTools?: string[];
  disallowedTools?: string[];
  readOnly?: boolean;
}): { allowed: string[]; disallowed: string[] } {
  const disallowedSet = new Set<string>(ALWAYS_DISALLOWED_TOOLS);
  if (opts.readOnly) for (const t of READ_ONLY_DISALLOWED_TOOLS) disallowedSet.add(t);
  for (const t of opts.disallowedTools ?? []) if (t) disallowedSet.add(t);

  let allowed = effectiveTools(opts.allowedTools);
  if (opts.readOnly) {
    const ro = new Set<string>(READ_ONLY_TOOLS);
    allowed = allowed.filter((t) => ro.has(t));
    if (!allowed.length) allowed = [...READ_ONLY_TOOLS];
  }
  allowed = allowed.filter((t) => !disallowedSet.has(t));

  return { allowed, disallowed: [...disallowedSet] };
}

type RawUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type RawResult = {
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

/**
 * Map a raw SDK/CLI result message to a HarnessResult. With subscription
 * billing `usage.costUsd` is 0 and the nominal figure moves to
 * `raw.nominalCostUsd`. Pure; exported for tests.
 */
export function toResult(
  raw: RawResult,
  requestedModel: string | undefined,
  engine: HarnessEngine,
  billing: HarnessBilling = "api"
): HarnessResult {
  const ok = raw.type === "result" && raw.subtype === "success" && !raw.is_error;
  const output =
    raw.result ??
    (raw.errors?.length ? raw.errors.join("\n") : `harness ended: ${raw.subtype ?? "unknown"}`);
  const usedModel = raw.modelUsage ? Object.keys(raw.modelUsage)[0] : undefined;
  return {
    ok,
    output,
    sessionId: raw.session_id,
    usage: mapUsage(raw.usage, chargeableCost(raw.total_cost_usd, billing)),
    provider: provider(),
    model: requestedModel ?? usedModel ?? "default",
    raw: { engine, billing, nominalCostUsd: raw.total_cost_usd ?? 0, ...raw },
  };
}

type RunOpts = {
  workspacePath: string;
  prompt: string;
  allowedTools: string[];
  disallowedTools: string[];
  /** "plan" for read-only runs, "acceptEdits" otherwise. */
  permissionMode: "plan" | "acceptEdits";
  model?: string;
  maxTurns: number;
  /** Continue an earlier headless session (SDK `resume`, CLI `--resume`). */
  resumeSessionId?: string;
  env: NodeJS.ProcessEnv;
  billing: HarnessBilling;
};

/** Argv for `claude` (without the binary). Pure; exported for tests. */
export function buildCliArgs(opts: {
  prompt: string;
  allowedTools: string[];
  disallowedTools: string[];
  permissionMode: "plan" | "acceptEdits";
  model?: string;
  resumeSessionId?: string;
}): string[] {
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "json",
    "--allowedTools",
    opts.allowedTools.join(","),
    // The installed claude CLI (2.1.x) supports --disallowedTools; see
    // `claude --help`. Deny always wins over allow.
    "--disallowedTools",
    opts.disallowedTools.join(","),
    "--permission-mode",
    opts.permissionMode,
  ];
  // Note: the installed `claude` CLI has no --max-turns flag, so maxTurns is
  // only enforced on the SDK path.
  if (opts.model) args.push("--model", opts.model);
  if (opts.resumeSessionId) args.push("--resume", assertSessionId(opts.resumeSessionId));
  return args;
}

async function runViaSdk(opts: RunOpts): Promise<HarnessResult> {
  // Non-literal specifier so the module resolves at runtime only; a missing
  // package throws here and the caller falls back to the CLI.
  const sdk = (await import(/* webpackIgnore: true */ SDK_SPECIFIER)) as {
    query: (params: { prompt: string; options?: Record<string, unknown> }) => AsyncIterable<RawResult>;
  };
  // The installed SDK's Options type accepts permissionMode "plan" and
  // disallowedTools (see node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts).
  const q = sdk.query({
    prompt: opts.prompt,
    options: {
      cwd: opts.workspacePath,
      allowedTools: opts.allowedTools,
      disallowedTools: opts.disallowedTools,
      permissionMode: opts.permissionMode,
      maxTurns: opts.maxTurns,
      env: opts.env,
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.resumeSessionId ? { resume: assertSessionId(opts.resumeSessionId) } : {}),
    },
  });
  let last: RawResult | undefined;
  for await (const msg of q) {
    if (msg?.type === "result") last = msg;
  }
  if (!last) throw new Error("harness: SDK query ended without a result message");
  return toResult(last, opts.model, "sdk", opts.billing);
}

async function runViaCli(opts: RunOpts): Promise<HarnessResult> {
  const args = buildCliArgs(opts);

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
  return toResult(raw, opts.model, "cli", opts.billing);
}

/**
 * Run Claude Code headless, scoped to `workspacePath`.
 *
 * Engine: `opts.engine` or `selectEngine(process.env)`. "sdk" uses the Agent
 * SDK `query()` when `@anthropic-ai/claude-agent-sdk` is installed and falls
 * back to the CLI otherwise; "cli" spawns `claude -p ... --output-format json`
 * directly. `resumeSessionId` continues an earlier session (SDK `resume`,
 * CLI `--resume`), which is how a Task becomes a multi-turn headless session.
 *
 * The child gets a minimal allowlisted env (see CHILD_ENV_ALLOWLIST), never
 * the full process.env. With `RHEA_HARNESS_AUTH=subscription` the child does
 * not receive ANTHROPIC_API_KEY, so the CLI uses the operator's stored login.
 * `allowedTools` is intersected with SAFE_TOOLS, so tenant config can only
 * narrow the tool set; Bash/WebFetch/WebSearch are always passed as
 * disallowed (see resolveToolPolicy). With `readOnly`, the run uses
 * permission mode "plan", allows only Read/Glob/Grep, and denies every
 * mutating tool. Env honored: CLAUDE_CODE_USE_VERTEX (reports provider
 * "vertex"), CLAUDE_CODE_USE_BEDROCK, plus whatever the SDK/CLI reads for
 * auth. Secrets are never logged. `raw.engine` records which engine ran.
 *
 * Model: `opts.model`, else RHEA_HARNESS_DEFAULT_MODEL, else Sonnet (see
 * resolveModel); the child never runs on its own default. Billing: with
 * RHEA_HARNESS_AUTH=subscription `usage.costUsd` is 0 (the nominal figure is
 * kept in `raw.nominalCostUsd`); see harnessBilling / chargeableCost.
 */
export async function runHarness(opts: {
  workspacePath: string;
  prompt: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  readOnly?: boolean;
  model?: string;
  maxTurns?: number;
  engine?: HarnessEngine;
  resumeSessionId?: string;
}): Promise<HarnessResult> {
  const policy = resolveToolPolicy({
    allowedTools: opts.allowedTools,
    disallowedTools: opts.disallowedTools,
    readOnly: opts.readOnly,
  });
  const normalized: RunOpts = {
    workspacePath: opts.workspacePath,
    prompt: opts.prompt,
    allowedTools: policy.allowed,
    disallowedTools: policy.disallowed,
    permissionMode: opts.readOnly ? "plan" : "acceptEdits",
    // Always pass an explicit model so the child never falls back to Opus.
    model: resolveModel(opts.model, process.env),
    maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
    resumeSessionId: opts.resumeSessionId,
    env: childEnv(),
    billing: harnessBilling(process.env),
  };
  const engine = opts.engine ?? selectEngine(process.env);
  if (engine === "cli") return runViaCli(normalized);
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

/** Session ids only ever come from Claude Code itself, but they are stored in
 *  the DB and passed to argv, so reject anything that could read as a flag. */
export function assertSessionId(id: string): string {
  if (!/^[A-Za-z0-9-]{1,128}$/.test(id)) {
    throw new Error("Invalid resume session id");
  }
  return id;
}
