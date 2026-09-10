import { defineTool } from "eve/tools";
import { z } from "zod";
import { deployPreview } from "../../../../lib/previewer.ts";
import { resolveTaskWorkspace } from "../../../../lib/worktree.ts";
import { getTask, updateTask, resolveAssignmentConfig } from "../../../../lib/platform.ts";

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
  description: "Deploy a preview build of the current Task's branch for the assigned site and record its URL.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this Task belongs to"),
    taskId: z.string().describe("The Task to preview"),
  }),
  async execute(input, ctx) {
    const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
    if (!orgId) {
      throw new Error("No organization found on the current session.");
    }

    const task = await getTask(input.taskId, orgId);
    if (!task) {
      throw new Error(`Task ${input.taskId} not found.`);
    }
    if (task.assignmentId !== input.assignmentId) {
      throw new Error(`Task ${input.taskId} does not belong to assignment ${input.assignmentId}.`);
    }

    // Full config (with decrypted publish credentials) stays in this scope only.
    const config = await resolveAssignmentConfig(input.assignmentId, orgId);
    const branch = branchForTask(input.taskId);

    try {
      // Each task has its own worktree; the previewer reads that tree, never
      // the shared main checkout.
      const wt = await resolveTaskWorkspace(config, branch);
      const { url } = await deployPreview({ config: wt, branch });
      await updateTask(input.taskId, orgId, { previewUrl: url, status: "previewed" });
      return { url };
    } catch (err) {
      await updateTask(input.taskId, orgId, { error: errorText(err) });
      throw err;
    }
  },
});
