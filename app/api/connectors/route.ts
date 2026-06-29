import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { startAuthorization } from "@vercel/connect";

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
    providerId: process.env.VERCEL_CONNECT_SENTRY_ID || "sentry",
    name: "Sentry",
  },
  datadog: {
    url: "https://mcp.datadoghq.com/sse",
    providerId: process.env.VERCEL_CONNECT_DATADOG_ID || "datadog",
    name: "Datadog",
  },
  github: {
    url: "https://api.githubcopilot.com/mcp/",
    providerId: process.env.VERCEL_CONNECT_GITHUB_ID || "github/rhea",
    name: "GitHub",
  },
  aws: {
    url: "https://mcp.amazonaws.com",
    providerId: process.env.VERCEL_CONNECT_AWS_ID || "aws",
    name: "AWS",
  },
  slack: {
    url: "https://mcp.slack.com/sse",
    providerId: process.env.VERCEL_CONNECT_SLACK_ID || "slack/rhea-connect",
    name: "Slack",
  },
  linear: {
    url: "https://mcp.linear.app/sse",
    providerId: process.env.VERCEL_CONNECT_LINEAR_ID || "linear/rhea-bloop",
    name: "Linear",
  },
  pagerduty: {
    url: "https://mcp.pagerduty.com/mcp",
    providerId: process.env.VERCEL_CONNECT_PAGERDUTY_ID || "pagerduty.com/orange-button",
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

    let instanceId: string;
    let isNew = true;

    if (existing.rows.length > 0) {
      instanceId = existing.rows[0].instance_id;
      isNew = false;
      // Update existing instance
      await queryDsql(
        `UPDATE connector_instances
         SET display_name = $3, status = 'ACTIVE', connected_by = $4,
             connected_at = CURRENT_TIMESTAMP
         WHERE instance_id = $1 AND org_id = $2;`,
        [instanceId, orgId, displayName || mcpMeta.name, userId]
      );
    } else {
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
      instanceId = insertRes.rows[0].instance_id;
    }

    // Attempt to generate Vercel Connect OAuth URL for the user
    let authorizationUrl: string | undefined;
    try {
      const origin = req.headers.get("origin") || "http://localhost:3000";
      const callbackUrl = `${origin}/connectors?connected=${connectorType}`;

      const authResponse = await startAuthorization(
        mcpMeta.providerId,
        {
          subject: {
            type: "user",
            id: userId,
            issuer: "authjs",
          },
        },
        {
          callbackUrl,
        }
      );
      authorizationUrl = authResponse.url;
    } catch (authErr: any) {
      console.warn(
        `[connectors API] Vercel Connect startAuthorization omitted/failed for ${connectorType}:`,
        authErr.message
      );
    }

    return NextResponse.json({
      success: true,
      message: isNew
        ? `${mcpMeta.name} connector registered`
        : `${mcpMeta.name} connector reconnected`,
      instanceId,
      authorizationUrl,
    });
  } catch (err: any) {
    console.error("[connectors API] POST failed:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to register connector" },
      { status: 500 }
    );
  }
}
