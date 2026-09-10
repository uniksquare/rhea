import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectEngine,
  usesSubscriptionAuth,
  buildChildEnv,
  buildCliArgs,
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
