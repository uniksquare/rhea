import { defineTool } from "eve/tools";
import { z } from "zod";
import { pushBranch, openPr } from "../../../../lib/github.ts";
import { getAssignment, updateTask } from "../../../../lib/platform.ts";
import type { AssignmentConfig } from "../../../../lib/assignment-types.ts";

// Deterministic branch name for a task, shared across this subagent's tools.
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

export default defineTool({
  description: "Push the current Task's branch and open a pull request for review.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this Task belongs to"),
    taskId: z.string().describe("The Task to open a PR for"),
    title: z.string().optional().describe("PR title; defaults to a generic task title"),
  }),
  async execute(input) {
    const assignment = await getAssignment(input.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found.`);
    }
    const config = assignment.config as AssignmentConfig;
    const branch = branchForTask(input.taskId);

    try {
      await pushBranch({ workspacePath: config.workspacePath, branch });
      const { url } = await openPr({
        workspacePath: config.workspacePath,
        branch,
        base: config.baseBranch,
        title: input.title ?? `rhea: site update (task ${input.taskId})`,
      });
      await updateTask(input.taskId, { prUrl: url });
      return { url };
    } catch (err: any) {
      await updateTask(input.taskId, { error: err?.message ?? String(err) });
      throw err;
    }
  },
});
