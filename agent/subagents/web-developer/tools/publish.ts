import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { publishLive } from "../../../../lib/publisher.ts";
import { resolveTaskWorkspace } from "../../../../lib/worktree.ts";
import { hasMinRole, type Role } from "../../../../lib/rbac.ts";
import { getTask, updateTask, claimTaskStatus, resolveAssignmentConfig } from "../../../../lib/platform.ts";
import { branchForTask, errorText } from "../../../../lib/task-chat.ts";

export default defineTool({
  description:
    "Publish the assigned site live from a previewed Task. Requires explicit human sign-off - never call this speculatively. Refuses tasks that have not been previewed.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment to publish"),
    taskId: z.string().describe("The Task being published; must be in status 'previewed'"),
  }),
  needsApproval: always(),
  // Status flow: previewed -> publishing (atomic claim) -> published on
  // success, back to previewed on failure. Mirrors app/api/tasks/[id]/publish.
  async execute(input, ctx) {
    const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
    if (!orgId) {
      throw new Error("No organization found on the current session.");
    }
    // Publishing goes live: ADMIN or OWNER only, regardless of tool approval.
    const rawRole = ctx.session.auth.current?.attributes?.role;
    const role = typeof rawRole === "string" ? rawRole : undefined;
    if (!role || !hasMinRole(role as Role, "ADMIN")) {
      throw new Error(
        `Forbidden: role "${role ?? "none"}" cannot publish; ADMIN or OWNER is required.`
      );
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

    // Atomically claim the task so two concurrent publishes cannot both proceed.
    const claimed = await claimTaskStatus(input.taskId, orgId, "previewed", "publishing");
    if (!claimed) {
      throw new Error(`Task ${input.taskId} is not previewed or is already being published.`);
    }

    try {
      // Full config (with decrypted publish credentials) stays in this scope only.
      const config = await resolveAssignmentConfig(input.assignmentId, orgId);
      const branch = branchForTask(input.taskId);
      // Publish from this task's own worktree so no other task's tree goes live.
      const wt = await resolveTaskWorkspace(config, branch);
      const { url } = await publishLive({ config: wt });
      await updateTask(input.taskId, orgId, { publishedUrl: url, status: "published" });
      return { url };
    } catch (err) {
      // Record the failure and revert the claim so the task can be retried.
      try {
        await updateTask(input.taskId, orgId, { status: "previewed", error: errorText(err) });
      } catch {
        // ignore secondary failure
      }
      throw err;
    }
  },
});
