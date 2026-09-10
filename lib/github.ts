import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(
  cmd: string,
  args: string[],
  cwd: string,
  opts: { allowFail?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
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
    throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${detail}`);
  }
}

const git = (args: string[], cwd: string, opts?: { allowFail?: boolean }) => run("git", args, cwd, opts);
const gh = (args: string[], cwd: string, opts?: { allowFail?: boolean }) => run("gh", args, cwd, opts);

/**
 * Check out `branch`, creating it from `base` (default "main") if it does not
 * exist locally or on origin.
 */
export async function ensureBranch({
  workspacePath,
  branch,
  base = "main",
}: {
  workspacePath: string;
  branch: string;
  base?: string;
}): Promise<void> {
  const local = await git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], workspacePath, {
    allowFail: true,
  });
  if (local.code === 0) {
    await git(["checkout", branch], workspacePath);
    return;
  }
  await git(["fetch", "origin", "--prune"], workspacePath, { allowFail: true });
  const remote = await git(
    ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`],
    workspacePath,
    { allowFail: true },
  );
  if (remote.code === 0) {
    await git(["checkout", "-b", branch, "--track", `origin/${branch}`], workspacePath);
    return;
  }
  const baseRef =
    (await git(["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${base}`], workspacePath, {
      allowFail: true,
    })).code === 0
      ? `origin/${base}`
      : base;
  await git(["checkout", "-b", branch, baseRef], workspacePath);
}

/**
 * Check out an existing branch. Throws a readable error if the working tree
 * is dirty (so nothing is carried across branches) or the branch is missing.
 */
export async function checkoutBranch({
  workspacePath,
  branch,
}: {
  workspacePath: string;
  branch: string;
}): Promise<void> {
  const status = await git(["status", "--porcelain"], workspacePath);
  if (status.stdout) {
    throw new Error(
      `cannot check out "${branch}" in ${workspacePath}: working tree has uncommitted changes`,
    );
  }
  const exists = await git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], workspacePath, {
    allowFail: true,
  });
  if (exists.code !== 0) {
    throw new Error(`cannot check out "${branch}" in ${workspacePath}: branch does not exist`);
  }
  await git(["checkout", branch], workspacePath);
}

/**
 * Stage and commit. With `paths`, only those paths (relative to the
 * workspace) are staged; without it, the whole tree is. Returns
 * `changed=false` (no throw) when nothing is staged; `sha` is then HEAD.
 */
export async function commitAll({
  workspacePath,
  message,
  paths,
}: {
  workspacePath: string;
  message: string;
  paths?: string[];
}): Promise<{ sha: string; changed: boolean }> {
  if (paths && paths.length) {
    await git(["add", "-A", "--", ...paths], workspacePath);
  } else {
    await git(["add", "-A"], workspacePath);
  }
  const staged = await git(["diff", "--cached", "--quiet"], workspacePath, { allowFail: true });
  if (staged.code === 0) {
    const head = await git(["rev-parse", "HEAD"], workspacePath);
    return { sha: head.stdout, changed: false };
  }
  await git(["commit", "-m", message], workspacePath);
  const head = await git(["rev-parse", "HEAD"], workspacePath);
  return { sha: head.stdout, changed: true };
}

/** `git push -u origin <branch>`. */
export async function pushBranch({
  workspacePath,
  branch,
}: {
  workspacePath: string;
  branch: string;
}): Promise<void> {
  await git(["push", "-u", "origin", branch], workspacePath);
}

/**
 * Open a PR from `branch` into `base` (default "main") with `gh pr create`.
 * If a PR already exists for the branch, returns its URL instead.
 */
export async function openPr({
  workspacePath,
  branch,
  base = "main",
  title,
  body = "",
}: {
  workspacePath: string;
  branch: string;
  base?: string;
  title: string;
  body?: string;
}): Promise<{ url: string }> {
  const existing = await gh(["pr", "view", branch, "--json", "url", "--jq", ".url"], workspacePath, {
    allowFail: true,
  });
  if (existing.code === 0 && existing.stdout.startsWith("http")) {
    return { url: existing.stdout };
  }
  const created = await gh(
    ["pr", "create", "--head", branch, "--base", base, "--title", title, "--body", body],
    workspacePath,
  );
  const url = created.stdout.split("\n").find((l) => l.startsWith("http"));
  if (url) return { url };
  const view = await gh(["pr", "view", branch, "--json", "url", "--jq", ".url"], workspacePath);
  if (!view.stdout.startsWith("http")) {
    throw new Error(`gh pr create succeeded but no PR URL was returned for ${branch}`);
  }
  return { url: view.stdout };
}
