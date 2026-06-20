import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { requirePermission } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "org:settings");
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const res = await queryDsql(
      `UPDATE organizations 
       SET name = $1 
       WHERE org_id = $2
       RETURNING org_id, name;`,
      [name, session.user.orgId]
    );

    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "org:delete");
    const orgId = session.user.orgId;

    console.log(`[org] Manually cleaning up resources for organization ${orgId}...`);

    // DSQL lacks CASCADE support, so we clean up in dependency order
    await queryDsql("DELETE FROM root_causes WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM investigations WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM incidents WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM fix_patterns WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM api_keys WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM org_settings WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM users WHERE org_id = $1;", [orgId]);
    await queryDsql("DELETE FROM organizations WHERE org_id = $1;", [orgId]);

    console.log(`[org] Organization ${orgId} deleted successfully.`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}
