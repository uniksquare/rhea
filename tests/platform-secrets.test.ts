import { test } from "node:test";
import assert from "node:assert/strict";
import type { AssignmentConfig } from "../lib/assignment-types.ts";

// lib/platform.ts imports lib/db.ts, which constructs PrismaClient and a pg
// Pool (lazily) at module scope; both need DATABASE_URL present in env to
// construct without throwing, but neither connects until a query runs.
process.env.DATABASE_URL ??= "postgresql://x:y@localhost:1/z";

const { splitSecrets } = await import("../lib/platform.ts");

function ftpConfig(): AssignmentConfig {
  return {
    repoUrl: "local",
    workspacePath: "/workspaces/site-a",
    siteDir: "shared",
    baseBranch: "main",
    publishTarget: {
      type: "hostinger-ftp",
      host: "ftp.example.com",
      port: 21,
      user: "deploy",
      pass: "s3cret",
      remoteDir: "/public_html/shared",
      baseUrl: "https://example.com",
    },
  };
}

function vercelConfig(): AssignmentConfig {
  return {
    repoUrl: "local",
    workspacePath: "/workspaces/site-b",
    siteDir: "shared",
    publishTarget: {
      type: "vercel",
      projectId: "prj_123",
      orgId: "team_1",
      token: "vt_topsecret",
    },
  };
}

test("splitSecrets strips publishTarget.pass into secrets.publishPass", () => {
  const config = ftpConfig();
  const { redacted, secrets } = splitSecrets(config);
  assert.equal(secrets.publishPass, "s3cret");
  assert.equal((redacted.publishTarget as Record<string, unknown>).pass, undefined);
  assert.ok(!("pass" in redacted.publishTarget));
});

test("splitSecrets strips publishTarget.token into secrets.vercelToken", () => {
  const config = vercelConfig();
  const { redacted, secrets } = splitSecrets(config);
  assert.equal(secrets.vercelToken, "vt_topsecret");
  assert.ok(!("token" in redacted.publishTarget));
  // Non-secret fields survive untouched.
  assert.equal((redacted.publishTarget as { projectId?: string }).projectId, "prj_123");
});

test("splitSecrets never mutates the input config", () => {
  const config = ftpConfig();
  const before = JSON.stringify(config);
  splitSecrets(config);
  assert.equal(JSON.stringify(config), before);
});

test("splitSecrets leaves a target with no pass/token untouched", () => {
  const config: AssignmentConfig = {
    repoUrl: "local",
    workspacePath: "/workspaces/site-c",
    publishTarget: { type: "vercel", projectId: "prj_1" },
  };
  const { redacted, secrets } = splitSecrets(config);
  assert.equal(secrets.publishPass, undefined);
  assert.equal(secrets.vercelToken, undefined);
  assert.deepEqual(redacted.publishTarget, { type: "vercel", projectId: "prj_1" });
});

test("splitSecrets merges caller-supplied extra secrets alongside publishPass/vercelToken", () => {
  const config = ftpConfig();
  const { secrets } = splitSecrets(config, { anthropicApiKey: "sk-xyz" });
  assert.equal(secrets.publishPass, "s3cret");
  assert.equal(secrets.anthropicApiKey, "sk-xyz");
});

test("redacted config JSON never contains the pass or token values", () => {
  const ftpRedacted = splitSecrets(ftpConfig()).redacted;
  const vercelRedacted = splitSecrets(vercelConfig()).redacted;
  assert.ok(!JSON.stringify(ftpRedacted).includes("s3cret"));
  assert.ok(!JSON.stringify(vercelRedacted).includes("vt_topsecret"));
  assert.ok(!JSON.stringify(ftpRedacted).includes('"pass"'));
  assert.ok(!JSON.stringify(vercelRedacted).includes('"token"'));
});

// resolveAssignmentConfig is the merge counterpart of splitSecrets, but it is
// not pure (it loads the row from the DB and decrypts secrets_enc), so it is
// exercised in integration tests rather than here. This test only documents
// the round trip splitSecrets is expected to support: whatever it strips out
// into `secrets`, resolveAssignmentConfig merges back onto `publishTarget`
// under the same key names (pass / token) for the matching target type.
test("splitSecrets output uses the field names resolveAssignmentConfig merges back", () => {
  const { secrets: ftpSecrets } = splitSecrets(ftpConfig());
  const { secrets: vercelSecrets } = splitSecrets(vercelConfig());
  assert.ok("publishPass" in ftpSecrets);
  assert.ok("vercelToken" in vercelSecrets);
});
