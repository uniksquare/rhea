import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { resolveTaskWorkspace, removeTaskWorkspace, worktreePathFor } from "../lib/worktree.ts";
import type { AssignmentConfig } from "../lib/assignment-types";

const SCRATCH =
  "/private/tmp/claude-501/-Users-soubhagyapanda-Desktop-gitrepos/25ea72db-53fd-4478-85f6-7b87e31a9d5d/scratchpad";
const repo = path.join(SCRATCH, `wt-test-${randomBytes(4).toString("hex")}`);
const BRANCH = "task/abc12345";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
  }).trim();
}

const config: AssignmentConfig = {
  repoUrl: "local",
  workspacePath: repo,
  siteDir: "shared",
  publishTarget: { type: "vercel" },
};

before(async () => {
  process.env.RHEA_WORKSPACE_ROOTS = SCRATCH;
  await fs.mkdir(path.join(repo, "shared"), { recursive: true });
  git(["init", "-q", "-b", "main"], repo);
  await fs.writeFile(path.join(repo, "shared", "index.html"), "<h1>hi</h1>\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "init"], repo);
});

after(async () => {
  await fs.rm(repo, { recursive: true, force: true });
});

test("worktreePathFor slugs the branch under .rhea/worktrees", () => {
  assert.equal(worktreePathFor(repo, BRANCH), path.join(repo, ".rhea", "worktrees", "task-abc12345"));
});

test("resolveTaskWorkspace creates an isolated worktree and is idempotent", async () => {
  const first = await resolveTaskWorkspace(config, BRANCH);
  const second = await resolveTaskWorkspace(config, BRANCH);
  assert.equal(first.workspacePath, second.workspacePath);
  assert.equal(first.workspacePath, worktreePathFor(repo, BRANCH));
  // Other config fields carry through untouched.
  assert.equal(first.siteDir, "shared");
  assert.deepEqual(first.publishTarget, config.publishTarget);

  // Main checkout untouched; worktree is on the task branch.
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], repo), "main");
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], first.workspacePath), BRANCH);
  assert.ok(await fs.stat(path.join(first.workspacePath, "shared", "index.html")));

  // Nested worktrees never appear as untracked in the main checkout.
  const exclude = await fs.readFile(path.join(repo, ".git", "info", "exclude"), "utf8");
  assert.ok(exclude.split(/\r?\n/).includes(".rhea/"));
  assert.equal(git(["status", "--porcelain"], repo), "");

  // Exclude line is appended only once.
  assert.equal(exclude.split(/\r?\n/).filter((l) => l === ".rhea/").length, 1);
});

test("a dirty main checkout does not block resolving a task worktree", async () => {
  await fs.writeFile(path.join(repo, "shared", "dirty.txt"), "uncommitted\n");
  const wt = await resolveTaskWorkspace(config, "task/deadbeef");
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], wt.workspacePath), "task/deadbeef");
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], repo), "main");
  await fs.rm(path.join(repo, "shared", "dirty.txt"));
});

test("removeTaskWorkspace drops the worktree but keeps the branch", async () => {
  const wtPath = worktreePathFor(repo, BRANCH);
  await removeTaskWorkspace(config, BRANCH);
  await assert.rejects(fs.access(wtPath));
  assert.equal(git(["show-ref", "--verify", `refs/heads/${BRANCH}`], repo).length > 0, true);
  // Re-resolving reuses the existing branch.
  const again = await resolveTaskWorkspace(config, BRANCH);
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], again.workspacePath), BRANCH);
});
