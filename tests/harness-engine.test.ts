import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectEngine,
  usesSubscriptionAuth,
  buildChildEnv,
  buildCliArgs,
  resolveModel,
  harnessBilling,
  chargeableCost,
  toResult,
  BUILT_IN_DEFAULT_MODEL,
} from "../lib/harness.ts";

// Next augments ProcessEnv with a required NODE_ENV; the helpers only read
// optional keys, so a plain record is fine at runtime.
const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;

test("selectEngine: defaults to sdk when unset or unknown", () => {
  assert.equal(selectEngine(env({})), "sdk");
  assert.equal(selectEngine(env({ RHEA_HARNESS_ENGINE: "" })), "sdk");
  assert.equal(selectEngine(env({ RHEA_HARNESS_ENGINE: "bogus" })), "sdk");
});

test("selectEngine: honours sdk and cli (case-insensitive, trimmed)", () => {
  assert.equal(selectEngine(env({ RHEA_HARNESS_ENGINE: "sdk" })), "sdk");
  assert.equal(selectEngine(env({ RHEA_HARNESS_ENGINE: "cli" })), "cli");
  assert.equal(selectEngine(env({ RHEA_HARNESS_ENGINE: " CLI " })), "cli");
});

test("usesSubscriptionAuth: only RHEA_HARNESS_AUTH=subscription", () => {
  assert.equal(usesSubscriptionAuth(env({})), false);
  assert.equal(usesSubscriptionAuth(env({ RHEA_HARNESS_AUTH: "api-key" })), false);
  assert.equal(usesSubscriptionAuth(env({ RHEA_HARNESS_AUTH: "subscription" })), true);
  assert.equal(usesSubscriptionAuth(env({ RHEA_HARNESS_AUTH: " Subscription " })), true);
});

test("buildChildEnv: forwards only allowlisted keys, never app secrets", () => {
  const out = buildChildEnv(env({
    PATH: "/bin",
    HOME: "/home/x",
    ANTHROPIC_API_KEY: "sk-test",
    DATABASE_URL: "postgres://secret",
    AUTH_SECRET: "s",
    ENCRYPTION_KEY: "k",
    CLAUDECODE: "1",
  }));
  assert.deepEqual(out, { PATH: "/bin", HOME: "/home/x", ANTHROPIC_API_KEY: "sk-test" });
});

test("buildChildEnv: subscription auth drops ANTHROPIC_API_KEY but keeps the rest", () => {
  const out = buildChildEnv(env({
    PATH: "/bin",
    HOME: "/home/x",
    ANTHROPIC_API_KEY: "sk-test",
    RHEA_HARNESS_AUTH: "subscription",
  }));
  assert.deepEqual(out, { PATH: "/bin", HOME: "/home/x" });
  assert.ok(!("ANTHROPIC_API_KEY" in out));
  assert.ok(!("RHEA_HARNESS_AUTH" in out));
});

const baseArgs = {
  prompt: "do the thing",
  allowedTools: ["Read", "Edit"],
  disallowedTools: ["Bash", "WebFetch"],
  permissionMode: "acceptEdits" as const,
};

test("buildCliArgs: base flags, no --resume and no --model by default", () => {
  const args = buildCliArgs(baseArgs);
  assert.deepEqual(args, [
    "-p",
    "do the thing",
    "--output-format",
    "json",
    "--allowedTools",
    "Read,Edit",
    "--disallowedTools",
    "Bash,WebFetch",
    "--permission-mode",
    "acceptEdits",
  ]);
  assert.ok(!args.includes("--resume"));
  assert.ok(!args.includes("--model"));
});

test("buildCliArgs: --resume <id> is appended when resumeSessionId is set", () => {
  const args = buildCliArgs({ ...baseArgs, resumeSessionId: "abc-123" });
  const i = args.indexOf("--resume");
  assert.ok(i > 0);
  assert.equal(args[i + 1], "abc-123");
});

test("buildCliArgs: --model and plan permission mode pass through", () => {
  const args = buildCliArgs({ ...baseArgs, permissionMode: "plan", model: "claude-sonnet-4-5" });
  const m = args.indexOf("--model");
  assert.equal(args[m + 1], "claude-sonnet-4-5");
  const p = args.indexOf("--permission-mode");
  assert.equal(args[p + 1], "plan");
});

test("buildCliArgs: empty resumeSessionId does not add --resume", () => {
  const args = buildCliArgs({ ...baseArgs, resumeSessionId: "" });
  assert.ok(!args.includes("--resume"));
});

test("resolveModel: explicit model wins, then env default, then Sonnet (never the CLI default)", () => {
  assert.equal(BUILT_IN_DEFAULT_MODEL, "claude-sonnet-4-5");
  assert.equal(resolveModel(undefined, env({})), "claude-sonnet-4-5");
  assert.equal(resolveModel("", env({})), "claude-sonnet-4-5");
  assert.equal(resolveModel(undefined, env({ RHEA_HARNESS_DEFAULT_MODEL: "claude-haiku-4-5" })), "claude-haiku-4-5");
  assert.equal(resolveModel(undefined, env({ RHEA_HARNESS_DEFAULT_MODEL: "  " })), "claude-sonnet-4-5");
  assert.equal(
    resolveModel("claude-opus-4-1", env({ RHEA_HARNESS_DEFAULT_MODEL: "claude-haiku-4-5" })),
    "claude-opus-4-1"
  );
});

test("harnessBilling: subscription only with RHEA_HARNESS_AUTH=subscription", () => {
  assert.equal(harnessBilling(env({})), "api");
  assert.equal(harnessBilling(env({ RHEA_HARNESS_AUTH: "api-key" })), "api");
  assert.equal(harnessBilling(env({ RHEA_HARNESS_AUTH: "subscription" })), "subscription");
  assert.equal(harnessBilling(env({ RHEA_HARNESS_AUTH: " SUBSCRIPTION " })), "subscription");
});

test("chargeableCost: api passes the cost through, subscription zeroes it", () => {
  assert.equal(chargeableCost(0.42, "api"), 0.42);
  assert.equal(chargeableCost(undefined, "api"), 0);
  assert.equal(chargeableCost(0.42, "subscription"), 0);
  assert.equal(chargeableCost(undefined, "subscription"), 0);
});

const rawOk = {
  type: "result",
  subtype: "success",
  is_error: false,
  result: "done",
  session_id: "sess-1",
  total_cost_usd: 0.1234,
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 1 },
};

test("toResult: api billing keeps costUsd and records nominalCostUsd", () => {
  const r = toResult(rawOk, "claude-sonnet-4-5", "cli", "api");
  assert.equal(r.ok, true);
  assert.equal(r.output, "done");
  assert.equal(r.sessionId, "sess-1");
  assert.equal(r.model, "claude-sonnet-4-5");
  assert.deepEqual(r.usage, {
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 2,
    cacheWriteTokens: 1,
    costUsd: 0.1234,
  });
  const raw = r.raw as { engine: string; billing: string; nominalCostUsd: number };
  assert.equal(raw.engine, "cli");
  assert.equal(raw.billing, "api");
  assert.equal(raw.nominalCostUsd, 0.1234);
});

test("toResult: subscription billing zeroes usage.costUsd but keeps raw.nominalCostUsd", () => {
  const r = toResult(rawOk, undefined, "sdk", "subscription");
  assert.equal(r.usage.costUsd, 0);
  assert.equal(r.usage.inputTokens, 10);
  const raw = r.raw as { engine: string; billing: string; nominalCostUsd: number };
  assert.equal(raw.billing, "subscription");
  assert.equal(raw.nominalCostUsd, 0.1234);
  assert.equal(raw.engine, "sdk");
});

test("toResult: defaults to api billing and reports errors as ok=false", () => {
  const r = toResult({ type: "result", subtype: "error_max_turns", is_error: true, total_cost_usd: 0.5 }, "m", "cli");
  assert.equal(r.ok, false);
  assert.equal(r.output, "harness ended: error_max_turns");
  assert.equal(r.usage.costUsd, 0.5);
});
