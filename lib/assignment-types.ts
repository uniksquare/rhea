/**
 * Shared types for the Web Developer role "Tools" libs
 * (harness, github, previewer, publisher).
 */

/** Where a site gets deployed. Credentials are passed to lftp and never logged. */
export type PublishTarget =
  | {
      type: "hostinger-ftp";
      host: string;
      port?: number;
      user: string;
      pass: string;
      /** Remote directory that holds the live site, e.g. "/public_html/shared". */
      remoteDir: string;
      /** Public URL of remoteDir, without trailing slash. */
      baseUrl: string;
    }
  | { type: "vercel"; projectId?: string };

/** Everything a single assignment needs to run, preview, and publish. */
export type AssignmentConfig = {
  repoUrl: string;
  /** Local checkout of repoUrl. All git/harness/lftp work is scoped here. */
  workspacePath: string;
  /** Subfolder of workspacePath that holds the static site. Default "shared". */
  siteDir?: string;
  /** Branch new work is cut from. Default "main". */
  baseBranch?: string;
  publishTarget: PublishTarget;
  /** Claude Code tools the harness may use. Default ["Read","Edit","Write","Glob","Grep"]. */
  allowedTools?: string[];
  /** Model id passed through to Claude Code. Omit for the CLI default. */
  model?: string;
};

/** Token and cost accounting for one harness run. */
export type HarnessUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
};

/** Result of one headless Claude Code run. */
export type HarnessResult = {
  ok: boolean;
  /** Final assistant text (or the error text when ok=false). */
  output: string;
  sessionId?: string;
  usage: HarnessUsage;
  provider: "anthropic" | "vertex";
  model: string;
  /** The raw result message from the SDK or CLI, for debugging. */
  raw?: unknown;
};
