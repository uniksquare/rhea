import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission, type Role } from "@/lib/rbac";
import { listTasks, getAssignment, createTask } from "@/lib/platform";

const REQUEST_MAX = 20000;

// GET /api/tasks?assignmentId=  -> tasks for this org (optionally one assignment)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get("assignmentId") || undefined;

  try {
    const tasks = await listTasks(session.user.orgId, assignmentId);
    return NextResponse.json(tasks);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}

// POST { assignmentId, request } -> create a task requesting a site change.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role as Role, "tasks:request");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = session.user.orgId;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { assignmentId, request: requestText } = body ?? {};
  if (typeof assignmentId !== "string" || assignmentId.length === 0) {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }
  if (
    typeof requestText !== "string" ||
    requestText.length === 0 ||
    requestText.length > REQUEST_MAX
  ) {
    return NextResponse.json(
      { error: `request must be a non-empty string of at most ${REQUEST_MAX} characters` },
      { status: 400 }
    );
  }

  try {
    const assignment = await getAssignment(assignmentId, orgId);
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const task = await createTask({ orgId, assignmentId, request: requestText });
    return NextResponse.json({ taskId: task.taskId, status: task.status }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}
