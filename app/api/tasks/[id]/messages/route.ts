import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTask, listTaskMessages } from "@/lib/platform";

// GET: the Task's chat thread, oldest first. Org-scoped; never returns secrets.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const rows = await listTaskMessages(id, orgId);
    return NextResponse.json({
      taskId: id,
      status: task.status,
      messages: rows.map((m) => ({
        messageId: m.messageId,
        role: m.role,
        content: m.content,
        mode: m.mode,
        usage: m.usage,
        createdAt: m.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}
