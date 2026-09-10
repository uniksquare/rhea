import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAssignment, listTasks } from "@/lib/platform";

// GET: one assignment (redacted config) plus its tasks
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const orgId = session.user.orgId;

  try {
    const assignment = await getAssignment(id, orgId);
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    const tasks = await listTasks(orgId, id);
    return NextResponse.json({ ...assignment, tasks });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}
