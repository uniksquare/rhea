import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AssignmentConfig, PublishTarget } from "@/lib/assignment-types";
// Relative imports with .ts extension: eve's bundler ignores tsconfig paths.
import { deployWithVercel } from "./vercel.ts";
import { assertWorkspacePath, resolveSiteDir } from "./assignment-validate.ts";

const execFileAsync = promisify(execFile);

/** Branch name to a URL/dir-safe slug: "feat/New Hero" -> "feat-new-hero". */
export function slug(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "preview";
}

type SafeKind = "host" | "port" | "path" | "user" | "pass" | "plain";

/**
 * Reject any value that could break out of the newline-delimited lftp script
 * (or its quoting). The lftp `-c` script is line based: a value containing
 * "\n!cmd" would run a shell command, so every interpolated value goes
 * through here first. Throws a message that never echoes the value for
 * credentials.
 */
export function assertSafeValue(name: string, value: unknown, kind: SafeKind = "plain"): void {
  const secret = kind === "pass" || kind === "user";
  const show = (v: unknown) => (secret ? "" : ` (${JSON.stringify(String(v))})`);
  if (kind === "port") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`invalid ${name}: must be an integer 1-65535${show(value)}`);
    }
    return;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid ${name}: must be a non-empty string`);
  }
  if (/[\r\n\0]/.test(value)) {
    throw new Error(`invalid ${name}: control characters are not allowed${show(value)}`);
  }
  if (kind === "host" && !/^[A-Za-z0-9.-]+$/.test(value)) {
    throw new Error(`invalid ${name}: must match [A-Za-z0-9.-]${show(value)}`);
  }
  if (kind === "path") {
    if (value.includes('"') || value.includes("\\")) {
      throw new Error(`invalid ${name}: quotes and backslashes are not allowed${show(value)}`);
    }
    if (value.startsWith("-")) {
      throw new Error(`invalid ${name}: must not start with "-"${show(value)}`);
    }
  }
  // `-u user,pass` splits on the first comma, so the user part must not contain one.
  if (kind === "user" && value.includes(",")) {
    throw new Error(`invalid ${name}: commas are not allowed`);
  }
}

function lftpQuote(s: string): string {
  // lftp strings: wrap in double quotes, escape backslash and double quote.
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function maskAll(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (!s) continue;
    out = out.split(s).join("***");
  }
  return out;
}

/**
 * Mirror `localDir` to `remoteDir` over FTP with TLS using lftp.
 * Settings match yogaessence/deploy.sh (known to work on Hostinger).
 * Credentials are passed as an argv item (`-u user,pass`, no shell), never
 * inside the script; every interpolated value is validated first and errors
 * are masked before they are thrown.
 */
export async function lftpMirror({
  target,
  localDir,
  remoteDir,
  deleteRemote = false,
  excludeHtaccess = false,
}: {
  target: Extract<PublishTarget, { type: "hostinger-ftp" }>;
  localDir: string;
  remoteDir: string;
  deleteRemote?: boolean;
  // Preview copies must not carry the site's own .htaccess: its RewriteBase
  // points at the live folder and would rewrite preview URLs to live pages.
  excludeHtaccess?: boolean;
}): Promise<void> {
  const port = target.port ?? 21;
  assertSafeValue("host", target.host, "host");
  assertSafeValue("port", port, "port");
  assertSafeValue("user", target.user, "user");
  assertSafeValue("pass", target.pass, "pass");
  assertSafeValue("remoteDir", remoteDir, "path");
  assertSafeValue("localDir", localDir, "path");

  const flags = [
    "--reverse",
    "--verbose",
    "--exclude-glob",
    ".DS_Store",
    "--exclude-glob",
    "*.swp",
  ];
  if (deleteRemote) flags.push("--delete");
  if (excludeHtaccess) flags.push("--exclude-glob", ".htaccess");
  const script = [
    "set ftp:ssl-allow true",
    "set ftp:ssl-protect-data true",
    "set ssl:verify-certificate no",
    "set net:max-retries 2",
    "set net:timeout 20",
    `mkdir -p -f ${lftpQuote(remoteDir)}`,
    `mirror ${flags.join(" ")} ${lftpQuote(localDir)} ${lftpQuote(remoteDir)}`,
    ...(excludeHtaccess ? [`rm -f ${lftpQuote(`${remoteDir}/.htaccess`)}`] : []),
    "bye",
  ].join("\n");

  // Credentials and site on argv (no shell), commands on stdin: the same shape
  // as the proven deploy.sh flow. On this lftp build `-c`/`-e` conflict with
  // `-u`/site arguments. `-u` splits on the first comma; user is validated to
  // contain none, so a comma in the password is fine.
  const args = ["-u", `${target.user},${target.pass}`, `ftp://${target.host}:${port}`];
  try {
    const run = execFileAsync("lftp", args, { maxBuffer: 20 * 1024 * 1024 });
    run.child.stdin?.end(script + "\n");
    await run;
  } catch (err) {
    const e = err as { code?: number | string; stderr?: string };
    const code = typeof e.code === "number" ? e.code : "unknown";
    const escapedPass = lftpQuote(target.pass).slice(1, -1);
    const escapedUser = lftpQuote(target.user).slice(1, -1);
    const stderr = maskAll((e.stderr ?? "").trim(), [
      target.pass,
      escapedPass,
      encodeURIComponent(target.pass),
      target.user,
      escapedUser,
    ]);
    throw new Error(`lftp mirror failed (exit ${code}): ${stderr}`);
  }
}

/**
 * Absolute local site dir for a config (workspacePath/siteDir, default "shared").
 * Defense in depth: throws unless workspacePath is inside an allowlisted
 * RHEA_WORKSPACE_ROOTS root and the site dir stays inside workspacePath, even
 * for rows that predate lib/assignment-validate.ts.
 */
export function siteDirOf(config: AssignmentConfig): string {
  const workspacePath = assertWorkspacePath(config.workspacePath);
  return resolveSiteDir(workspacePath, config.siteDir ?? "shared");
}

/**
 * Deploy the branch's site to a preview location and return its URL.
 *
 * hostinger-ftp: mirrors `<workspacePath>/<siteDir>` to
 * `<remoteDir>/preview/<slug(branch)>` and returns `${baseUrl}/preview/<slug>/`.
 * vercel: runs `vercel deploy` in `<workspacePath>/<siteDir>` and returns the
 * preview deployment URL. Auto deploy on main merge comes from Vercel's own Git
 * integration when the repo is linked; this CLI path is for FTP-less assignments.
 */
export async function deployPreview({
  config,
  branch,
}: {
  config: AssignmentConfig;
  branch: string;
}): Promise<{ url: string }> {
  const target = config.publishTarget;
  if (target.type === "vercel") {
    return deployWithVercel({ cwd: siteDirOf(config), prod: false, target });
  }
  const s = slug(branch);
  assertSafeValue("branch slug", s, "path");
  assertSafeValue("remoteDir", target.remoteDir, "path");
  const remoteDir = `${target.remoteDir.replace(/\/+$/, "")}/preview/${s}`;
  await lftpMirror({ target, localDir: siteDirOf(config), remoteDir, deleteRemote: true, excludeHtaccess: true });
  const baseUrl = target.baseUrl.replace(/\/+$/, "");
  return { url: `${baseUrl}/preview/${s}/` };
}
