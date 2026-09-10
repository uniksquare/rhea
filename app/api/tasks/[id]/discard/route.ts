import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission, type Role } from "@/lib/rbac";
import { claimTaskStatus, getAssignment, getTask, updateTask, type TaskStatus } from "@/lib/platform";
import { removeTaskWorkspace } from "@/lib/worktree";

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

// POST: soft-discard a task. Published tasks cannot be discarded, and a task
// that is mid-turn (working) or mid-publish (publishing) is refused so its
// worktree is never removed from under a running harness or deploy.
//
// Status flow: current (requested | planning | previewed | failed) -> discarded
// via an atomic claim; the worktree is removed only after the claim succeeds.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.user.role as Role, "tasks:discard");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const orgId = session.user.orgId;

  try {
    const task = await getTask(id, orgId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.status === "published") {
      return NextResponse.json({ error: "Published tasks cannot be discarded" }, { status: 409 });
    }
    if (task.status === "publishing") {
      return NextResponse.json({ error: "Task is currently being published" }, { status: 409 });
    }
    if (task.status === "working") {
      return NextResponse.json({ error: "Task is busy" }, { status: 409 });
    }
    if (task.status === "discarded") {
      return NextResponse.json(task);
    }
    const claimed = await claimTaskStatus(id, orgId, task.status as TaskStatus, "discarded");
    if (!claimed) {
      // Something raced us (a turn, preview or publish started); do not touch the worktree.
      return NextResponse.json({ error: "Task is busy" }, { status: 409 });
    }
    await cleanupWorktree(id, orgId, task.assignmentId, task.branch);
    return NextResponse.json({ ...task, status: "discarded" });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}
