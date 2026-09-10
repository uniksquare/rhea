import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { publishLive } from "../../../../lib/publisher.ts";
import { getAssignment, updateTask } from "../../../../lib/platform.ts";
import type { AssignmentConfig } from "../../../../lib/assignment-types.ts";

export default defineTool({
  description: "Publish the assigned site live. Requires explicit human sign-off - never call this speculatively.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment to publish"),
    taskId: z.string().describe("The Task being published"),
  }),
  needsApproval: always(),
  async execute(input) {
    const assignment = await getAssignment(input.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found.`);
    }
    const config = assignment.config as AssignmentConfig;

    try {
      const { url } = await publishLive({ config });
      await updateTask(input.taskId, { publishedUrl: url, status: "published" });
      return { url };
    } catch (err: any) {
      await updateTask(input.taskId, { error: err?.message ?? String(err) });
      throw err;
    }
  },
});
