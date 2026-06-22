import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await queryDsql(
      `SELECT chat_id, title, agent_session_state, created_at, updated_at 
       FROM agent_chats 
       WHERE org_id = $1 
       ORDER BY updated_at DESC;`,
      [session.user.orgId]
    );
    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error("[GET /api/chats] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, agent_session_state } = body;

    const res = await queryDsql(
      `INSERT INTO agent_chats (org_id, title, agent_session_state)
       VALUES ($1, $2, $3)
       RETURNING chat_id, title, agent_session_state, created_at, updated_at;`,
      [
        session.user.orgId,
        title || "New Chat",
        agent_session_state ? JSON.stringify(agent_session_state) : null,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/chats] Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
