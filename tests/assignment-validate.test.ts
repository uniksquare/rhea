import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AssignmentConfigError,
  assertWorkspacePath,
  resolveSiteDir,
  validateAssignmentConfig,
  workspaceRoots,
} from "../lib/assignment-validate.ts";
import { siteDirOf } from "../lib/previewer.ts";

let root: string;
let ws: string;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "rhea-roots-"));
  ws = path.join(root, "site-a");
  process.env.RHEA_WORKSPACE_ROOTS = root;
});

function ftpConfig(overrides: Record<string, unknown> = {}, target: Record<string, unknown> = {}) {
  return {
    repoUrl: "local",
    workspacePath: ws,
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
      ...target,
    },
    ...overrides,
  };
}

function rejects(config: unknown, re: RegExp) {
  assert.throws(() => validateAssignmentConfig(config), (err: unknown) => {
    assert.ok(err instanceof AssignmentConfigError, `expected AssignmentConfigError, got ${String(err)}`);
    assert.match(err.message, re);
    return true;
  });
}

test("workspaceRoots reads RHEA_WORKSPACE_ROOTS at call time", () => {
  assert.deepEqual(workspaceRoots(), [root]);
  const saved = process.env.RHEA_WORKSPACE_ROOTS;
  process.env.RHEA_WORKSPACE_ROOTS = ` ${root} , /other/root `;
  assert.deepEqual(workspaceRoots(), [root, path.resolve("/other/root")]);
  delete process.env.RHEA_WORKSPACE_ROOTS;
  assert.deepEqual(workspaceRoots(), [path.join(process.cwd(), "workspaces")]);
  process.env.RHEA_WORKSPACE_ROOTS = saved;
});

test("valid hostinger-ftp config is normalized", () => {
  const out = validateAssignmentConfig(ftpConfig({ allowedTools: ["Read", "Edit", "Read"] }));
  assert.equal(out.workspacePath, ws);
  assert.equal(out.siteDir, "shared");
  assert.equal(out.baseBranch, "main");
  assert.deepEqual(out.allowedTools, ["Read", "Edit"]);
  assert.equal(out.publishTarget.type, "hostinger-ftp");
  if (out.publishTarget.type === "hostinger-ftp") {
    assert.equal(out.publishTarget.port, 21);
    assert.equal(out.publishTarget.pass, "s3cret");
    assert.equal(out.publishTarget.baseUrl, "https://example.com");
  }
});

test("siteDir defaults to shared and port defaults to 21", () => {
  const out = validateAssignmentConfig(ftpConfig({ siteDir: undefined }, { port: undefined }));
  assert.equal(out.siteDir, "shared");
  if (out.publishTarget.type === "hostinger-ftp") assert.equal(out.publishTarget.port, 21);
});

test("rejects workspacePath path traversal", () => {
  // Built by string concat: path.join would normalize the ".." away.
  rejects(ftpConfig({ workspacePath: `${ws}/../../etc` }), /workspacePath.*\.\./);
  // Even when the normalized result would land inside the root, ".." is refused.
  rejects(ftpConfig({ workspacePath: `${ws}/../site-a` }), /workspacePath.*\.\./);
  rejects(ftpConfig({ workspacePath: "relative/dir" }), /workspacePath.*absolute/);
  rejects(ftpConfig({ workspacePath: `${ws}\n!rm -rf /` }), /workspacePath.*control/);
});

test("rejects workspacePath outside the allowlisted roots", () => {
  rejects(ftpConfig({ workspacePath: "/any/dir" }), /workspacePath.*allowed workspace root/);
  rejects(ftpConfig({ workspacePath: "/" }), /workspacePath/);
  // Prefix match is on path segments: "<root>-evil" is not inside "<root>".
  rejects(ftpConfig({ workspacePath: `${root}-evil` }), /workspacePath.*allowed workspace root/);
  assert.throws(() => assertWorkspacePath("/any/dir"), AssignmentConfigError);
  assert.equal(assertWorkspacePath(root), root);
});

test("rejects siteDir traversal and absolute siteDir", () => {
  rejects(ftpConfig({ siteDir: "../other" }), /siteDir.*\.\./);
  rejects(ftpConfig({ siteDir: "shared/../../x" }), /siteDir.*\.\./);
  rejects(ftpConfig({ siteDir: "/etc" }), /siteDir.*relative/);
  rejects(ftpConfig({ siteDir: "sha\nred" }), /siteDir.*control/);
  assert.throws(() => resolveSiteDir(ws, "../x"), AssignmentConfigError);
  assert.equal(resolveSiteDir(ws, "dist/site"), path.join(ws, "dist", "site"));
});

test("siteDirOf enforces the same root and siteDir rules", () => {
  const good = validateAssignmentConfig(ftpConfig({ siteDir: "shared" }));
  assert.equal(siteDirOf(good), path.join(ws, "shared"));
  assert.throws(() => siteDirOf({ ...good, workspacePath: "/any/dir", siteDir: "." }), AssignmentConfigError);
  assert.throws(() => siteDirOf({ ...good, siteDir: "../../x" }), AssignmentConfigError);
});

test("rejects bad host", () => {
  rejects(ftpConfig({}, { host: "ftp.example.com;rm -rf /" }), /publishTarget\.host/);
  rejects(ftpConfig({}, { host: "ftp.example.com\nbye" }), /publishTarget\.host/);
  rejects(ftpConfig({}, { host: "" }), /publishTarget\.host/);
});

test("rejects bad port", () => {
  rejects(ftpConfig({}, { port: 0 }), /publishTarget\.port/);
  rejects(ftpConfig({}, { port: 70000 }), /publishTarget\.port/);
  rejects(ftpConfig({}, { port: "21" }), /publishTarget\.port/);
  rejects(ftpConfig({}, { port: 21.5 }), /publishTarget\.port/);
});

test("rejects javascript: and non-http baseUrl", () => {
  rejects(ftpConfig({}, { baseUrl: "javascript:alert(1)" }), /baseUrl/);
  rejects(ftpConfig({}, { baseUrl: "ftp://example.com" }), /baseUrl/);
  rejects(ftpConfig({}, { baseUrl: "not a url" }), /baseUrl/);
  rejects(ftpConfig({}, { baseUrl: "" }), /baseUrl/);
});

test("rejects unsafe user, remoteDir and pass", () => {
  rejects(ftpConfig({}, { user: "a,b" }), /publishTarget\.user/);
  rejects(ftpConfig({}, { remoteDir: '/x"y' }), /publishTarget\.remoteDir/);
  rejects(ftpConfig({}, { remoteDir: "-rf" }), /publishTarget\.remoteDir/);
  rejects(ftpConfig({}, { pass: "a\nb" }), /publishTarget\.pass/);
  // Errors never echo the credential value.
  assert.throws(
    () => validateAssignmentConfig(ftpConfig({}, { user: "hunter2,x" })),
    (err: Error) => !err.message.includes("hunter2")
  );
});

test("rejects disallowed tools", () => {
  rejects(ftpConfig({ allowedTools: ["Read", "Bash"] }), /allowedTools.*Bash/);
  rejects(ftpConfig({ allowedTools: ["WebFetch"] }), /allowedTools/);
  rejects(ftpConfig({ allowedTools: "Read" }), /allowedTools.*array/);
});

test("rejects bad baseBranch and repoUrl", () => {
  rejects(ftpConfig({ baseBranch: "-rf" }), /baseBranch/);
  rejects(ftpConfig({ baseBranch: "a..b" }), /baseBranch/);
  rejects(ftpConfig({ baseBranch: "a b" }), /baseBranch/);
  rejects(ftpConfig({ baseBranch: "x".repeat(101) }), /baseBranch/);
  rejects(ftpConfig({ repoUrl: "http://example.com/repo.git" }), /repoUrl/);
  rejects(ftpConfig({ repoUrl: "file:///etc/passwd" }), /repoUrl/);
  rejects(ftpConfig({ repoUrl: "" }), /repoUrl/);
  assert.doesNotThrow(() => validateAssignmentConfig(ftpConfig({ repoUrl: "https://github.com/o/r.git" })));
  assert.doesNotThrow(() => validateAssignmentConfig(ftpConfig({ repoUrl: "git@github.com:o/r.git" })));
});

test("vercel target validates projectId/orgId/scope as plain and rejects unknown type", () => {
  const out = validateAssignmentConfig(
    ftpConfig({}, { type: "vercel", projectId: "prj_123", orgId: "team_1", scope: "my-team", prodBranch: "main" })
  );
  assert.deepEqual(out.publishTarget, {
    type: "vercel",
    projectId: "prj_123",
    orgId: "team_1",
    scope: "my-team",
    prodBranch: "main",
  });
  rejects(ftpConfig({}, { type: "vercel", projectId: "a\nb" }), /publishTarget\.projectId/);
  rejects(ftpConfig({}, { type: "vercel", scope: 42 }), /publishTarget\.scope/);
  rejects(ftpConfig({}, { type: "s3" }), /publishTarget\.type/);
  rejects(ftpConfig({ publishTarget: null }), /publishTarget/);
});
