import type { AssignmentConfig } from "@/lib/assignment-types";
// Relative import with .ts extension: eve's bundler ignores tsconfig paths.
import { lftpMirror, siteDirOf } from "./previewer.ts";
import { deployWithVercel } from "./vercel.ts";

/**
 * Publish the site to its live location and return the live URL.
 *
 * hostinger-ftp: mirrors `<workspacePath>/<siteDir>` to `<remoteDir>` without
 * `--delete`, so the `preview/` folder and any other remote-only files are
 * left untouched. Returns `{ url: baseUrl }`.
 * vercel: runs `vercel deploy --prod` in `<workspacePath>/<siteDir>` and returns
 * the production URL. Auto deploy on main merge comes from Vercel's own Git
 * integration when the repo is linked; this CLI path is for FTP-less assignments.
 */
export async function publishLive({
  config,
}: {
  config: AssignmentConfig;
}): Promise<{ url: string }> {
  const target = config.publishTarget;
  if (target.type === "vercel") {
    return deployWithVercel({ cwd: siteDirOf(config), prod: true, target });
  }
  const remoteDir = target.remoteDir.replace(/\/+$/, "") || "/";
  await lftpMirror({ target, localDir: siteDirOf(config), remoteDir, deleteRemote: false });
  return { url: target.baseUrl.replace(/\/+$/, "") };
}
