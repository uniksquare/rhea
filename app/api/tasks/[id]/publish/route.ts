import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinRole, type Role } from "@/lib/rbac";
import { getTask, resolveAssignmentConfig, updateTask, claimTaskStatus } from "@/lib/platform";
import { resolveTaskWorkspace } from "@/lib/worktree";
import { publishLive } from "@/lib/publisher";

const ERR_MAX = 500;

// POST: publish a previewed task live (OWNER/ADMIN only). Never returns secrets.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const orgId = session.user.orgId;

  const task = await getTask(id, orgId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!task.branch) {
    return NextResponse.json({ error: "Task has no branch to publish" }, { status: 409 });
  }

  // Atomically claim the task so two concurrent publish requests cannot both proceed.
  const claimed = await claimTaskStatus(id, orgId, "previewed", "publishing");
  if (!claimed) {
    return NextResponse.json(
      { error: "Task is not previewed or is already being published" },
      { status: 409 }
    );
  }

  try {
    // Decrypted config stays in memory here only; it is never logged or returned.
    const config = await resolveAssignmentConfig(task.assignmentId, orgId);
    // Publish from the task's own worktree; the shared checkout is never touched.
    const wt = await resolveTaskWorkspace(config, task.branch);
    const { url } = await publishLive({ config: wt });
    await updateTask(id, orgId, { status: "published", publishedUrl: url });
    return NextResponse.json({ ...task, status: "published", publishedUrl: url });
  } catch (err: any) {
    const message = String(err?.message || err).slice(0, ERR_MAX);
    // Record the failure and revert the claim so the task can be retried.
    try {
      await updateTask(id, orgId, { status: "previewed", error: message });
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
