import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";

/**
 * GET /api/connectors/status
 *
 * Returns the connection status of each MCP connector type for the
 * current user's organization. The UI polls this to reflect which
 * providers have active OAuth grants.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;

  try {
    const res = await queryDsql(
      `SELECT connector_type, status, connected_by, connected_at, last_health_check
       FROM connector_instances
       WHERE org_id = $1 AND status = 'ACTIVE';`,
      [orgId]
    );

    // Build a map of connector_type → connection status
    const statusMap: Record<string, {
      connected: boolean;
      connectedBy: string | null;
      connectedAt: string | null;
      lastHealthCheck: string | null;
    }> = {};

    for (const row of res.rows) {
      statusMap[row.connector_type] = {
        connected: true,
        connectedBy: row.connected_by,
        connectedAt: row.connected_at,
        lastHealthCheck: row.last_health_check,
      };
    }

    return NextResponse.json(statusMap);
  } catch (err: any) {
    console.error("[connectors status API] GET failed:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch connection status" },
      { status: 500 }
    );
  }
}
