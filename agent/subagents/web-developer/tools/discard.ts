import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAssignment, getTask, updateTask } from "../../../../lib/platform.ts";
import { removeTaskWorkspace } from "../../../../lib/worktree.ts";

/**
 * Free the disk space a task's worktree used, keeping the branch (and its
 * commits) around in case it is revived. Best-effort: a cleanup failure must
 * never fail the discard itself, so every error is swallowed here after being
 * logged and (if possible) noted on the task. Skipped when the task never got
 * a branch (its worktree was never created).
 *
 * `branch` is the same value edit_site.ts / publish.ts derive from the taskId
 * (task/<first 8 alnum chars>); once a task is edited, task.branch is set to
 * exactly that value, so reading it back here needs no re-derivation.
 */
async function cleanupWorktree(taskId: string, orgId: string, assignmentId: string, branch: string | null) {
  if (!branch) return;
  try {
    const assignment = await getAssignment(assignmentId, orgId);
    if (!assignment) return;
    await removeTaskWorkspace(assignment.config, branch);
  } catch {
    // Never include the caught error (may contain workspace paths or other
    // details) in logs or the stored task error; the task id is enough.
    console.warn("[discard] worktree cleanup failed for task", taskId);
    try {
      await updateTask(taskId, orgId, { error: "worktree cleanup failed" });
    } catch {
      // Best-effort note; a failure here must not surface to the caller.
    }
  }
}

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
    await cleanupWorktree(input.taskId, orgId, task.assignmentId, task.branch);
    return { taskId: input.taskId, status: "discarded", reason: input.reason };
  },
});
