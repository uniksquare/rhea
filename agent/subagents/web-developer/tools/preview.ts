import { defineTool } from "eve/tools";
import { z } from "zod";
import { deployPreview } from "../../../../lib/previewer.ts";
import { getAssignment, updateTask } from "../../../../lib/platform.ts";
import type { AssignmentConfig } from "../../../../lib/assignment-types.ts";

// Deterministic branch name for a task, shared across this subagent's tools.
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

export default defineTool({
  description: "Deploy a preview build of the current Task's branch for the assigned site and record its URL.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this Task belongs to"),
    taskId: z.string().describe("The Task to preview"),
  }),
  async execute(input) {
    const assignment = await getAssignment(input.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found.`);
    }
    const config = assignment.config as AssignmentConfig;
    const branch = branchForTask(input.taskId);

    try {
      const { url } = await deployPreview({ config, branch });
      await updateTask(input.taskId, { previewUrl: url, status: "previewed" });
      return { url };
    } catch (err: any) {
      await updateTask(input.taskId, { error: err?.message ?? String(err) });
      throw err;
    }
  },
});
