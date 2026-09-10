import type { AssignmentConfig } from "@/lib/assignment-types";
import { lftpMirror, siteDirOf } from "@/lib/previewer";

/**
 * Publish the site to its live location and return the live URL.
 *
 * hostinger-ftp: mirrors `<workspacePath>/<siteDir>` to `<remoteDir>` without
 * `--delete`, so the `preview/` folder and any other remote-only files are
 * left untouched. Returns `{ url: baseUrl }`.
 * vercel: not implemented yet (throws).
 */
export async function publishLive({
  config,
}: {
  config: AssignmentConfig;
}): Promise<{ url: string }> {
  const target = config.publishTarget;
  if (target.type === "vercel") {
    // TODO: implement with `vercel deploy --prod` once the Vercel target is wired up.
    throw new Error("vercel publish not implemented yet");
  }
  const remoteDir = target.remoteDir.replace(/\/+$/, "") || "/";
  await lftpMirror({ target, localDir: siteDirOf(config), remoteDir, deleteRemote: false });
  return { url: target.baseUrl.replace(/\/+$/, "") };
}
