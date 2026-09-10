import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTask, updateTask } from "@/lib/platform";

// POST: soft-discard a task. Published tasks cannot be discarded.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (task.status === "discarded") {
      return NextResponse.json(task);
    }
    await updateTask(id, orgId, { status: "discarded" });
    return NextResponse.json({ ...task, status: "discarded" });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}
