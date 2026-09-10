import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTasks } from "@/lib/platform";

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
