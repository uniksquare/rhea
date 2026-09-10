import { defineTool } from "eve/tools";
import { z } from "zod";
import { updateTask } from "../../../../lib/platform.ts";

export default defineTool({
  description:
    "Soft-discard a Task without publishing: marks it discarded but keeps its branch and commits around in case it's needed later.",
  inputSchema: z.object({
    taskId: z.string().describe("The Task to discard"),
    reason: z.string().optional().describe("Why the task is being discarded"),
  }),
  async execute(input) {
    await updateTask(input.taskId, { status: "discarded" });
    return { taskId: input.taskId, status: "discarded", reason: input.reason };
  },
});
