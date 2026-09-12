import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission, type Role } from "@/lib/rbac";
import { getAssignment, getTask, updateTask, claimTaskStatus } from "@/lib/platform";
import { resolveTaskWorkspace } from "@/lib/worktree";

const ERR_MAX = 500;

/**
 * POST: revive a discarded task back to "planning". Clears any stored error
 * from the discard/failure that preceded it. If the task has a branch, its
 * worktree is re-created (discard removes the worktree but keeps the branch);
 * a re-creation failure is recorded on the task but never reverts the status
 * out of "planning" -- the task stays revived and can be retried from there.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.user.role as Role, "tasks:request");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const orgId = session.user.orgId;

  const task = await getTask(id, orgId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "discarded") {
    return NextResponse.json({ error: "Only discarded tasks can be revived" }, { status: 409 });
  }

  const claimed = await claimTaskStatus(id, orgId, "discarded", "planning");
  if (!claimed) {
    return NextResponse.json({ error: "Task is not discarded or was already revived" }, { status: 409 });
  }

  await updateTask(id, orgId, { error: "" });

  if (task.branch) {
    try {
      const assignment = await getAssignment(task.assignmentId, orgId);
      await resolveTaskWorkspace(assignment!.config, task.branch);
    } catch (err: any) {
      const message = String(err?.message || err).slice(0, ERR_MAX);
      try {
        await updateTask(id, orgId, { error: message });
      } catch {
        // Best-effort note; a failure here must not surface to the caller.
      }
    }
  }

  return NextResponse.json({ ok: true, status: "planning" });
}
