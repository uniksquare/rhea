import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Create a draft GitHub Pull Request with proposed code or configuration changes.",
  inputSchema: z.object({
    repo: z.string().default("rhea-platform/rhea-app").describe("Target GitHub repository (owner/repo)"),
    branch: z.string().describe("Branch name containing the fix"),
    title: z.string().describe("PR title describing the remediation"),
    description: z.string().describe("Detailed description of the changes made and incident reference"),
    changes: z.string().describe("A git diff string or list of file changes"),
  }),
  async execute({ repo, branch, title, description, changes }) {
    console.log(`[GitHub Mock] Drafting PR for ${repo} on branch ${branch}...`);
    const prNumber = Math.floor(Math.random() * 100) + 1;
    
    return {
      status: "success",
      message: "GitHub Draft Pull Request created successfully.",
      pr_url: `https://github.com/${repo}/pull/${prNumber}`,
      pr_number: prNumber,
      title,
      branch,
      target_repo: repo,
      diff_analyzed: `${changes.substring(0, 100)}... (${changes.length} characters)`
    };
  }
});
