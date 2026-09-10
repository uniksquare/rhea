import { defineTool } from "eve/tools";
import { z } from "zod";
import { getTask, updateTask } from "../../../../lib/platform.ts";

export default defineTool({
  description:
    "Soft-discard a Task without publishing: marks it discarded but keeps its branch and commits around in case it's needed later.",
  inputSchema: z.object({
    taskId: z.string().describe("The Task to discard"),
    reason: z.string().optional().describe("Why the task is being discarded"),
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
    if (task.status === "published") {
      throw new Error(`Task ${input.taskId} is already published and cannot be discarded.`);
    }

    await updateTask(input.taskId, orgId, { status: "discarded" });
    return { taskId: input.taskId, status: "discarded", reason: input.reason };
  },
});
