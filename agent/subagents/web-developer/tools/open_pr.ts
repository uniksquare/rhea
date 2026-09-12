import { defineTool } from "eve/tools";
import { z } from "zod";
import { pushBranch, openPr } from "../../../../lib/github.ts";
import { getAssignment, getTask, updateTask } from "../../../../lib/platform.ts";

// Deterministic branch name for a task, shared across this subagent's tools.
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

export default defineTool({
  description: "Push the current Task's branch and open a pull request for review.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this Task belongs to"),
    taskId: z.string().describe("The Task to open a PR for"),
    title: z.string().optional().describe("PR title; defaults to a generic task title"),
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
    const task = await getTask(input.taskId, orgId);
    if (!task) {
      throw new Error(`Task ${input.taskId} not found.`);
    }
    if (task.assignmentId !== input.assignmentId) {
      throw new Error(`Task ${input.taskId} does not belong to assignment ${input.assignmentId}.`);
    }

    const config = assignment.config;
    const branch = branchForTask(input.taskId);

    try {
      await pushBranch({ workspacePath: config.workspacePath, branch });
      const { url } = await openPr({
        workspacePath: config.workspacePath,
        branch,
        base: config.baseBranch,
        title: input.title ?? `rhea: site update (task ${input.taskId})`,
      });
      await updateTask(input.taskId, orgId, { prUrl: url });
      return { url };
    } catch (err) {
      await updateTask(input.taskId, orgId, { error: errorText(err) });
      throw err;
    }
  },
});
