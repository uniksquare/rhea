import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { requirePermission, hasMinRole } from "@/lib/rbac";
import { getOrgMembers } from "@/lib/tenant";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "incidents:read");
    const members = await getOrgMembers(session.user.orgId);
    return NextResponse.json(members);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "members:manage");
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }

    // Verify user belongs to same org
    const userCheck = await queryDsql(
      "SELECT org_id, role FROM users WHERE user_id = $1;",
      [userId]
    );

    if (userCheck.rows.length === 0 || userCheck.rows[0].org_id !== session.user.orgId) {
      return NextResponse.json({ error: "User not found in your organization" }, { status: 404 });
    }

    const targetUserRole = userCheck.rows[0].role;

    // Enforce role hierarchy (e.g. ADMIN cannot demote OWNER)
    if (targetUserRole === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Cannot modify Owner role" }, { status: 403 });
    }

    const res = await queryDsql(
      `UPDATE users 
       SET role = $1 
       WHERE user_id = $2 AND org_id = $3
       RETURNING user_id, email, name, role;`,
      [role, userId, session.user.orgId]
    );

    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "members:manage");
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Verify target user belongs to same org
    const userCheck = await queryDsql(
      "SELECT org_id, role, email FROM users WHERE user_id = $1;",
      [userId]
    );

    if (userCheck.rows.length === 0 || userCheck.rows[0].org_id !== session.user.orgId) {
      return NextResponse.json({ error: "User not found in your organization" }, { status: 404 });
    }

    const targetUser = userCheck.rows[0];

    // Cannot remove owner
    if (targetUser.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove organization Owner" }, { status: 403 });
    }

    // Cannot remove yourself
    if (targetUser.email === session.user.email) {
      return NextResponse.json({ error: "Cannot remove yourself from organization" }, { status: 400 });
    }

    await queryDsql(
      "DELETE FROM users WHERE user_id = $1 AND org_id = $2;",
      [userId, session.user.orgId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}
