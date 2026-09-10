import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { PublishTarget } from "@/lib/assignment-types";
// Relative import with .ts extension: eve's bundler ignores tsconfig paths.
import { assertSafeValue } from "./previewer.ts";

const execFileAsync = promisify(execFile);

type VercelTarget = Extract<PublishTarget, { type: "vercel" }>;

/** Local `vercel` CLI (devDependency) when present, else whatever is on PATH. */
function vercelBin(): string {
  const local = path.join(process.cwd(), "node_modules", ".bin", "vercel");
  return existsSync(local) ? local : "vercel";
}

/** Last https://*.vercel.app URL in the output, else the last https URL, else undefined. */
function parseDeploymentUrl(text: string): string | undefined {
  const all = text.match(/https:\/\/[^\s"'<>]+/g) ?? [];
  const app = all.filter((u) => /^https:\/\/[^/\s]+\.vercel\.app(\/|$)/.test(u));
  const pick = app.length > 0 ? app[app.length - 1] : all[all.length - 1];
  return pick?.replace(/[.,;:)\]]+$/, "");
}

/**
 * Run `vercel deploy` in `cwd` (the site directory) and return the deployment
 * URL. Auth is target.token (per-assignment, decrypted from secrets_enc) with
 * VERCEL_TOKEN from the process env as a fallback; org/project come from the
 * target with the env as fallback. The child gets an allowlisted env only,
 * and the token (whichever source it came from) is never logged or included
 * in thrown errors.
 */
export async function deployWithVercel({
  cwd,
  prod,
  target,
}: {
  cwd: string;
  prod: boolean;
  target: VercelTarget;
}): Promise<{ url: string }> {
  assertSafeValue("cwd", cwd, "path");
  if (target.scope !== undefined) assertSafeValue("scope", target.scope, "plain");
  if (target.orgId !== undefined) assertSafeValue("orgId", target.orgId, "plain");
  if (target.projectId !== undefined) assertSafeValue("projectId", target.projectId, "plain");

  const token = target.token ?? process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("no Vercel token: set publishTarget.token (per-assignment) or VERCEL_TOKEN");
  }

  // Allowlisted env only: nothing else from process.env leaks into the CLI.
  // Cast: Next's ProcessEnv augmentation requires NODE_ENV, which we deliberately omit.
  const env = { VERCEL_TOKEN: token } as Record<string, string> as NodeJS.ProcessEnv;
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  const orgId = target.orgId ?? process.env.VERCEL_ORG_ID;
  const projectId = target.projectId ?? process.env.VERCEL_PROJECT_ID;
  // A project id is mandatory so the CLI links to an existing project instead
  // of auto-creating one from the directory name.
  if (!projectId) {
    throw new Error("Vercel target requires projectId (or VERCEL_PROJECT_ID)");
  }
  if (orgId) env.VERCEL_ORG_ID = orgId;
  env.VERCEL_PROJECT_ID = projectId;

  // `--yes` skips the interactive link/scope prompts, which only makes sense
  // when the CLI can resolve the project from env. Without both ids we let it
  // fail loudly (non-interactive stdin) rather than accept defaults.
  const nonInteractive = Boolean(orgId && projectId);

  const args = [
    "deploy",
    ...(nonInteractive ? ["--yes"] : []),
    ...(prod ? ["--prod"] : []),
    ...(target.scope ? ["--scope", target.scope] : []),
  ];

  const mask = (s: string) => s.split(token).join("***");
  let stdout = "";
  let stderr = "";
  try {
    const res = await execFileAsync(vercelBin(), args, { cwd, env, maxBuffer: 20 * 1024 * 1024 });
    stdout = res.stdout ?? "";
    stderr = res.stderr ?? "";
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    const code = typeof e.code === "number" ? e.code : "unknown";
    const detail = mask(((e.stderr ?? "") + "\n" + (e.stdout ?? "")).trim() || e.message || "");
    throw new Error(`vercel deploy failed (exit ${code}): ${detail}`);
  }

  // The CLI prints the URL on stdout; the human-readable log goes to stderr.
  const url = parseDeploymentUrl(stdout) ?? parseDeploymentUrl(stderr);
  if (!url) {
    throw new Error(`vercel deploy succeeded but no deployment URL was found in output: ${mask(stderr.trim()).slice(-500)}`);
  }
  return { url };
}
