import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";

/**
 * MCP connector registry.
 * Maps connector_type to its remote MCP server URL and Vercel Connect provider UID.
 */
const MCP_CONNECTORS: Record<
  string,
  { url: string; providerId: string; name: string }
> = {
  sentry: {
    url: "https://mcp.sentry.dev/sse",
    providerId: "sentry",
    name: "Sentry",
  },
  datadog: {
    url: "https://mcp.datadoghq.com/sse",
    providerId: "datadog",
    name: "Datadog",
  },
  github: {
    url: "https://api.githubcopilot.com/mcp/",
    providerId: "github",
    name: "GitHub",
  },
  aws: {
    url: "https://mcp.amazonaws.com",
    providerId: "aws",
    name: "AWS",
  },
  slack: {
    url: "https://mcp.slack.com/sse",
    providerId: "slack",
    name: "Slack",
  },
  linear: {
    url: "https://mcp.linear.app/sse",
    providerId: "linear",
    name: "Linear",
  },
  pagerduty: {
    url: "https://mcp.pagerduty.com/mcp",
    providerId: "pagerduty",
    name: "PagerDuty",
  },
};

// GET: Retrieve all MCP connector instances for the organization
export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;

  try {
    const res = await queryDsql(
      `SELECT instance_id, connector_type, display_name, mcp_url,
              connect_provider_id, connected_by, status,
              last_health_check, created_at, connected_at
       FROM connector_instances
       WHERE org_id = $1
       ORDER BY created_at DESC;`,
      [orgId]
    );

    const instances = res.rows.map((row) => ({
      instanceId: row.instance_id,
      connectorType: row.connector_type,
      displayName: row.display_name,
      mcpUrl: row.mcp_url,
      connectProviderId: row.connect_provider_id,
      connectedBy: row.connected_by,
      status: row.status,
      lastHealthCheck: row.last_health_check,
      createdAt: row.created_at,
      connectedAt: row.connected_at,
    }));

    return NextResponse.json(instances);
  } catch (err: any) {
    console.error("[connectors API] GET failed:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// POST: Register an MCP connector instance (after OAuth flow completes)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;
  const userId = session.user.id;

  try {
    const { connectorType, displayName } = await req.json();

    if (!connectorType) {
      return NextResponse.json(
        { error: "Missing connectorType" },
        { status: 400 }
      );
    }

    const mcpMeta = MCP_CONNECTORS[connectorType];
    if (!mcpMeta) {
      return NextResponse.json(
        { error: `Unknown connector type: ${connectorType}` },
        { status: 400 }
      );
    }

    // Check if this connector type already exists for the org
    const existing = await queryDsql(
      `SELECT instance_id FROM connector_instances
       WHERE org_id = $1 AND connector_type = $2 LIMIT 1;`,
      [orgId, connectorType]
    );

    if (existing.rows.length > 0) {
      // Update existing instance
      await queryDsql(
        `UPDATE connector_instances
         SET display_name = $3, status = 'ACTIVE', connected_by = $4,
             connected_at = CURRENT_TIMESTAMP
         WHERE instance_id = $1 AND org_id = $2;`,
        [existing.rows[0].instance_id, orgId, displayName || mcpMeta.name, userId]
      );

      return NextResponse.json({
        success: true,
        message: `${mcpMeta.name} connector reconnected`,
        instanceId: existing.rows[0].instance_id,
      });
    }

    // Insert new MCP connector instance
    const insertRes = await queryDsql(
      `INSERT INTO connector_instances
         (org_id, connector_type, display_name, mcp_url, connect_provider_id,
          connected_by, status, connected_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', CURRENT_TIMESTAMP)
       RETURNING instance_id;`,
      [
        orgId,
        connectorType,
        displayName || mcpMeta.name,
        mcpMeta.url,
        mcpMeta.providerId,
        userId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `${mcpMeta.name} connector registered`,
      instanceId: insertRes.rows[0].instance_id,
    });
  } catch (err: any) {
    console.error("[connectors API] POST failed:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to register connector" },
      { status: 500 }
    );
  }
}
