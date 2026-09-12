import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAssignment } from "../../../../lib/platform.ts";

const execFileAsync = promisify(execFile);

/**
 * Code Reviewer-specific assignment config fields, layered on top of the
 * shared AssignmentConfig (repoUrl, baseBranch, ...). See
 * docs/roles/code-reviewer.md for the full shape; kept local to this tool
 * since lib/assignment-types.ts is shared across Roles and out of scope here.
 */
type ReviewConfig = {
  schedule?: string;
  maxPrs?: number;
  rules?: string[];
  postComments?: boolean;
};

/** Matches https://github.com/<owner>/<repo>(.git)?, with or without a trailing slash, or git@github.com:<owner>/<repo>(.git)?. */
const GITHUB_URL_RE =
  /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;

function parseGitHubRepo(repoUrl: string): string {
  const match = GITHUB_URL_RE.exec(repoUrl.trim());
  if (!match) {
    throw new Error(
      `Assignment's repoUrl "${repoUrl}" is not a GitHub URL (expected https://github.com/<owner>/<repo> or git@github.com:<owner>/<repo>).`,
    );
  }
  return `${match[1]}/${match[2]}`;
}

type GhPr = {
  number: number;
  title: string;
  author: { login: string } | null;
  updatedAt: string;
  url: string;
};

export default defineTool({
  description:
    "List the open pull requests on the assignment's GitHub repo (read-only; no LLM call, no writes).",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment whose repo's open PRs to list"),
  }),
  async execute(input, ctx) {
    const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
    if (!orgId) {
      throw new Error("No organization found on the current session.");
    }

    const assignment = await getAssignment(input.assignmentId, orgId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found.`);
    }

    const config = assignment.config as typeof assignment.config & { review?: ReviewConfig };
    if (!config.repoUrl) {
      throw new Error(`Assignment ${input.assignmentId} has no repoUrl configured.`);
    }
    const repo = parseGitHubRepo(config.repoUrl);
    const maxPrs = config.review?.maxPrs ?? 10;

    let stdout: string;
    try {
      const result = await execFileAsync(
        "gh",
        [
          "pr",
          "list",
          "--repo",
          repo,
          "--state",
          "open",
          "--limit",
          String(maxPrs),
          "--json",
          "number,title,author,updatedAt,url",
        ],
        { maxBuffer: 10 * 1024 * 1024 },
      );
      stdout = result.stdout;
    } catch (err) {
      const e = err as { stderr?: string; stdout?: string; message?: string };
      const detail = (e.stderr || e.stdout || e.message || "").trim();
      throw new Error(`gh pr list --repo ${repo} failed: ${detail}`);
    }

    let prs: GhPr[];
    try {
      prs = JSON.parse(stdout) as GhPr[];
    } catch {
      throw new Error(`gh pr list --repo ${repo} returned output that could not be parsed as JSON.`);
    }

    return {
      assignmentId: input.assignmentId,
      repo,
      count: prs.length,
      prs: prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.author?.login ?? null,
        updatedAt: pr.updatedAt,
        url: pr.url,
      })),
    };
  },
});
