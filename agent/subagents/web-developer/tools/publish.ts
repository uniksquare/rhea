import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { publishLive } from "../../../../lib/publisher.ts";
import { checkoutBranch } from "../../../../lib/github.ts";
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
  description:
    "Publish the assigned site live from a previewed Task. Requires explicit human sign-off - never call this speculatively. Refuses tasks that have not been previewed.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment to publish"),
    taskId: z.string().describe("The Task being published; must be in status 'previewed'"),
  }),
  needsApproval: always(),
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
    if (task.status !== "previewed") {
      throw new Error(
        `Task ${input.taskId} is in status "${task.status}"; only previewed tasks can be published. Run preview first.`
      );
    }

    // Full config (with decrypted publish credentials) stays in this scope only.
    const config = await resolveAssignmentConfig(input.assignmentId, orgId);
    const branch = branchForTask(input.taskId);

    try {
      // The workspace checkout is shared across tasks; make sure it is on this
      // task's branch so no other task's tree goes live.
      await checkoutBranch({ workspacePath: config.workspacePath, branch });
      const { url } = await publishLive({ config });
      await updateTask(input.taskId, orgId, { publishedUrl: url, status: "published" });
      return { url };
    } catch (err) {
      await updateTask(input.taskId, orgId, { error: errorText(err) });
      throw err;
    }
  },
});
