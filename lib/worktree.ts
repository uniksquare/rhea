/**
 * Per-task git worktrees.
 *
 * edit_site / preview / publish used to `checkout` the task branch inside the
 * one shared `workspacePath`, so two concurrent Tasks fought over the same
 * working tree and a dirty tree made checkout throw. Instead, every task
 * branch gets its own worktree under `<workspacePath>/.rhea/worktrees/<slug>`
 * and the tools operate on that path. The main checkout never changes branch.
 *
 * `.rhea/` is added to `.git/info/exclude` so the nested worktrees never show
 * up as untracked files in the main checkout (or get staged by `git add -A`).
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { AssignmentConfig } from "./assignment-types";
// Relative imports with .ts extension: eve's bundler ignores tsconfig paths.
import { slug } from "./previewer.ts";

const execFileAsync = promisify(execFile);

/** The subset of AssignmentConfig (full or redacted) the worktree layer needs. */
export type WorkspaceConfig = Pick<AssignmentConfig, "workspacePath" | "baseBranch">;

const WORKTREES_DIR = path.join(".rhea", "worktrees");
const EXCLUDE_LINE = ".rhea/";

async function git(
  args: string[],
  cwd: string,
  opts: { allowFail?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    if (opts.allowFail) {
      return {
        code: typeof e.code === "number" ? e.code : 1,
        stdout: (e.stdout ?? "").trim(),
        stderr: (e.stderr ?? "").trim(),
      };
    }
    const detail = (e.stderr || e.stdout || e.message || "").trim();
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${detail}`);
  }
}

/** Absolute worktree path for `branch` under `workspacePath`. */
export function worktreePathFor(workspacePath: string, branch: string): string {
  return path.join(workspacePath, WORKTREES_DIR, slug(branch));
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Append `.rhea/` to `<workspacePath>/.git/info/exclude` when it is missing. */
async function ensureExcluded(workspacePath: string): Promise<void> {
  // Resolve the real git dir (handles the main checkout itself being a worktree
  // or using a gitfile); `--git-common-dir` is where info/exclude lives.
  const common = await git(["rev-parse", "--git-common-dir"], workspacePath);
  const gitDir = path.resolve(workspacePath, common.stdout || ".git");
  const infoDir = path.join(gitDir, "info");
  const excludeFile = path.join(infoDir, "exclude");
  await fs.mkdir(infoDir, { recursive: true });
  let current = "";
  try {
    current = await fs.readFile(excludeFile, "utf8");
  } catch {
    current = "";
  }
  const lines = current.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(EXCLUDE_LINE)) return;
  const sep = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  await fs.appendFile(excludeFile, `${sep}${EXCLUDE_LINE}\n`, "utf8");
}

async function branchExists(workspacePath: string, branch: string): Promise<boolean> {
  const r = await git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], workspacePath, {
    allowFail: true,
  });
  return r.code === 0;
}

/**
 * Return a copy of `config` whose `workspacePath` points at an isolated
 * worktree checked out on `branch`. Idempotent: an existing worktree on the
 * right branch is reused. A missing branch is created from
 * `config.baseBranch` (default "main").
 */
export async function resolveTaskWorkspace<C extends WorkspaceConfig>(
  config: C,
  branch: string,
): Promise<C> {
  const workspacePath = config.workspacePath;
  const wtPath = worktreePathFor(workspacePath, branch);

  await ensureExcluded(workspacePath);

  if (await exists(wtPath)) {
    const head = await git(["rev-parse", "--abbrev-ref", "HEAD"], wtPath, { allowFail: true });
    if (head.code === 0 && head.stdout === branch) {
      return { ...config, workspacePath: wtPath };
    }
    throw new Error(
      `worktree ${wtPath} exists but is on "${head.stdout || "unknown"}" instead of "${branch}"; remove it before retrying`,
    );
  }

  await fs.mkdir(path.dirname(wtPath), { recursive: true });
  // A stale registration (dir deleted by hand) would make `worktree add` refuse.
  await git(["worktree", "prune"], workspacePath, { allowFail: true });

  if (await branchExists(workspacePath, branch)) {
    // `git worktree add` refuses a branch that is already checked out
    // somewhere. The common case is the shared checkout being left on a task
    // branch by an older flow: move it back to the base branch if it is clean.
    const base = config.baseBranch ?? "main";
    const holder = await worktreeHoldingBranch(workspacePath, branch);
    if (holder) {
      const main = path.resolve(workspacePath);
      if (path.resolve(holder) === main) {
        const status = await git(["status", "--porcelain"], workspacePath, { allowFail: true });
        if (status.stdout.trim() !== "") {
          throw new Error(
            `branch "${branch}" is checked out in the shared workspace with uncommitted changes; commit or clean it before retrying`,
          );
        }
        await git(["checkout", base], workspacePath);
      } else {
        throw new Error(
          `branch "${branch}" is already checked out at ${holder}; remove that worktree before retrying`,
        );
      }
    }
    await git(["worktree", "add", wtPath, branch], workspacePath);
  } else {
    const base = config.baseBranch ?? "main";
    await git(["worktree", "add", wtPath, "-b", branch, base], workspacePath);
  }

  return { ...config, workspacePath: wtPath };
}

/**
 * Remove the worktree for `branch` (forced, so uncommitted changes in it are
 * discarded). The branch itself is kept.
 */
export async function removeTaskWorkspace(config: WorkspaceConfig, branch: string): Promise<void> {
  const workspacePath = config.workspacePath;
  const wtPath = worktreePathFor(workspacePath, branch);
  if (await exists(wtPath)) {
    await git(["worktree", "remove", "--force", wtPath], workspacePath);
  }
  await git(["worktree", "prune"], workspacePath, { allowFail: true });
}

/**
 * Throw away every uncommitted change under `paths` in `workspacePath`:
 * tracked files are restored from HEAD (`git checkout -- <paths>`) and
 * untracked files and directories are deleted (`git clean -fd -- <paths>`).
 * Used after a failed edit turn so a half-applied harness edit never lingers
 * in the task worktree. Paths are passed as argv, never through a shell.
 */
export async function revertPaths({
  workspacePath,
  paths,
}: {
  workspacePath: string;
  paths: string[];
}): Promise<void> {
  if (paths.length === 0) return;
  // `checkout -- <pathspec>` errors when nothing tracked matches (e.g. a
  // brand-new siteDir); only untracked files exist then, so skip to clean.
  const tracked = await git(["ls-files", "--", ...paths], workspacePath);
  if (tracked.stdout !== "") {
    await git(["checkout", "--", ...paths], workspacePath);
  }
  await git(["clean", "-fd", "--", ...paths], workspacePath);
}

/** Path of the worktree (or the shared checkout) that has `branch` checked out, if any. */
async function worktreeHoldingBranch(workspacePath: string, branch: string): Promise<string | null> {
  const list = await git(["worktree", "list", "--porcelain"], workspacePath, { allowFail: true });
  if (list.code !== 0) return null;
  let current: string | null = null;
  for (const line of list.stdout.split("\n")) {
    if (line.startsWith("worktree ")) current = line.slice("worktree ".length).trim();
    else if (line.trim() === `branch refs/heads/${branch}` && current) return current;
  }
  return null;
}
