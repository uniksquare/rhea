import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission, type Role } from "@/lib/rbac";
import { getTask, resolveAssignmentConfig, updateTask } from "@/lib/platform";
import { resolveTaskWorkspace } from "@/lib/worktree";
import { deployPreview } from "@/lib/previewer";
import { errorText } from "@/lib/task-chat";

// Deploying a preview mirrors the site over FTP; allow it time.
export const maxDuration = 300;

// POST: deploy a preview build of the task's branch. Never returns secrets.
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
  if (!task.branch) {
    return NextResponse.json({ error: "Task has no branch to preview" }, { status: 409 });
  }
  if (task.status !== "planning" && task.status !== "previewed") {
    return NextResponse.json(
      { error: `Task is ${task.status}; only planning or previewed tasks can be previewed` },
      { status: 409 }
    );
  }

  try {
    // Decrypted config stays in memory here only; it is never logged or returned.
    const config = await resolveAssignmentConfig(task.assignmentId, orgId);
    const wt = await resolveTaskWorkspace(config, task.branch);
    const { url } = await deployPreview({ config: wt, branch: task.branch });
    await updateTask(id, orgId, { previewUrl: url, status: "previewed" });
    return NextResponse.json({ ok: true, previewUrl: url, status: "previewed" });
  } catch (err) {
    const message = errorText(err);
    try {
      await updateTask(id, orgId, { error: message });
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
