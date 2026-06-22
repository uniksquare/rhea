import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  const orgId = session.user.orgId;

  try {
    const res = await queryDsql(
      "SELECT chat_id, title, agent_session_state, created_at, updated_at FROM agent_chats WHERE chat_id = $1 AND org_id = $2;",
      [chatId, orgId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    console.error(`[GET /api/chats/${chatId}] Error:`, err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  const orgId = session.user.orgId;

  try {
    const body = await request.json();
    const { title, agent_session_state } = body;

    const updates: string[] = [];
    const values: any[] = [chatId, orgId];
    let counter = 3;

    if (title !== undefined) {
      updates.push(`title = $${counter}`);
      values.push(title);
      counter++;
    }

    if (agent_session_state !== undefined) {
      updates.push(`agent_session_state = $${counter}`);
      values.push(agent_session_state ? JSON.stringify(agent_session_state) : null);
      counter++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const query = `
      UPDATE agent_chats 
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = $1 AND org_id = $2
      RETURNING *;
    `;

    const res = await queryDsql(query, values);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    console.error(`[PATCH /api/chats/${chatId}] Error:`, err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  const orgId = session.user.orgId;

  try {
    const res = await queryDsql(
      "DELETE FROM agent_chats WHERE chat_id = $1 AND org_id = $2 RETURNING chat_id;",
      [chatId, orgId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: chatId });
  } catch (err: any) {
    console.error(`[DELETE /api/chats/${chatId}] Error:`, err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
