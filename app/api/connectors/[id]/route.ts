import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing connector instance ID" }, { status: 400 });
  }

  try {
    const res = await queryDsql(
      `DELETE FROM connector_instances
       WHERE instance_id = $1 AND org_id = $2;`,
      [id, orgId]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: "Connector instance not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Connector deleted successfully" });
  } catch (err: any) {
    console.error(`[connectors delete API] Failed to delete ${id}:`, err.message);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
