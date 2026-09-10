import { defineTool } from "eve/tools";
import { z } from "zod";
import { deployPreview } from "../../../../lib/previewer.ts";
import { resolveTaskWorkspace } from "../../../../lib/worktree.ts";
import { getTask, updateTask, resolveAssignmentConfig } from "../../../../lib/platform.ts";
import { branchForTask, claimFromAny, errorText } from "../../../../lib/task-chat.ts";

export default defineTool({
  description: "Deploy a preview build of the current Task's branch for the assigned site and record its URL.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this Task belongs to"),
    taskId: z.string().describe("The Task to preview"),
  }),
  // Status flow: prev (planning | previewed) -> working (atomic claim) ->
  // previewed on success, back to prev on failure. "previewed" is never
  // written unless the deploy actually succeeded.
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
    if (task.status !== "planning" && task.status !== "previewed") {
      throw new Error(
        `Task ${input.taskId} is in status "${task.status}"; only planning or previewed tasks can be previewed.`
      );
    }

    const claim = await claimFromAny(input.taskId, orgId, "working");
    if (!claim.ok) {
      throw new Error(`Task ${input.taskId} is busy.`);
    }
    const prev = claim.prev;

    try {
      // Full config (with decrypted publish credentials) stays in this scope only.
      const config = await resolveAssignmentConfig(input.assignmentId, orgId);
      const branch = branchForTask(input.taskId);
      // Each task has its own worktree; the previewer reads that tree, never
      // the shared main checkout.
      const wt = await resolveTaskWorkspace(config, branch);
      const { url } = await deployPreview({ config: wt, branch });
      await updateTask(input.taskId, orgId, { previewUrl: url, status: "previewed" });
      return { url };
    } catch (err) {
      try {
        await updateTask(input.taskId, orgId, { status: prev, error: errorText(err) });
      } catch {
        // ignore secondary failure
      }
      throw err;
    }
  },
});
