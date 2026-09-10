import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { AssignmentConfig, PublishTarget } from "@/lib/assignment-types";

const execFileAsync = promisify(execFile);

/** Branch name to a URL/dir-safe slug: "feat/New Hero" -> "feat-new-hero". */
export function slug(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "preview";
}

function lftpQuote(s: string): string {
  // lftp strings: wrap in double quotes, escape backslash and double quote.
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Mirror `localDir` to `remoteDir` over FTP with TLS using lftp.
 * Settings match yogaessence/deploy.sh (known to work on Hostinger).
 * Credentials go into the lftp script passed as one argv item; nothing is
 * echoed and errors are sanitized before they are thrown.
 */
export async function lftpMirror({
  target,
  localDir,
  remoteDir,
  deleteRemote = false,
}: {
  target: Extract<PublishTarget, { type: "hostinger-ftp" }>;
  localDir: string;
  remoteDir: string;
  deleteRemote?: boolean;
}): Promise<void> {
  const port = target.port ?? 21;
  const flags = [
    "--reverse",
    "--verbose",
    "--exclude-glob",
    ".DS_Store",
    "--exclude-glob",
    "*.swp",
  ];
  if (deleteRemote) flags.push("--delete");
  const script = [
    "set ftp:ssl-allow true",
    "set ftp:ssl-protect-data true",
    "set ssl:verify-certificate no",
    "set net:max-retries 2",
    "set net:timeout 20",
    `open -u ${lftpQuote(target.user)},${lftpQuote(target.pass)} ftp://${target.host}:${port}`,
    `mkdir -p -f ${lftpQuote(remoteDir)}`,
    `mirror ${flags.join(" ")} ${lftpQuote(localDir)} ${lftpQuote(remoteDir)}`,
    "bye",
  ].join("\n");

  try {
    await execFileAsync("lftp", ["-c", script], { maxBuffer: 20 * 1024 * 1024 });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const text = (e.stderr || e.message || "lftp failed")
      .split(target.pass)
      .join("***")
      .trim();
    throw new Error(`lftp mirror to ${target.host}:${remoteDir} failed: ${text}`);
  }
}

/** Absolute local site dir for a config (workspacePath/siteDir, default "shared"). */
export function siteDirOf(config: AssignmentConfig): string {
  return path.join(config.workspacePath, config.siteDir ?? "shared");
}

/**
 * Deploy the branch's site to a preview location and return its URL.
 *
 * hostinger-ftp: mirrors `<workspacePath>/<siteDir>` to
 * `<remoteDir>/preview/<slug(branch)>` and returns `${baseUrl}/preview/<slug>/`.
 * vercel: not implemented yet (throws).
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
    // TODO: implement with `vercel deploy` once the Vercel target is wired up.
    throw new Error("vercel preview not implemented yet");
  }
  const s = slug(branch);
  const remoteDir = `${target.remoteDir.replace(/\/+$/, "")}/preview/${s}`;
  await lftpMirror({ target, localDir: siteDirOf(config), remoteDir, deleteRemote: true });
  const baseUrl = target.baseUrl.replace(/\/+$/, "");
  return { url: `${baseUrl}/preview/${s}/` };
}
