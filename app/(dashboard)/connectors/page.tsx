import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { queryDsql } from "@/lib/dsql";
import { ConnectorsClient } from "./connectors-client";

export default async function ConnectorsPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;

  // Retrieve existing MCP connector instances
  let initialConnectors: any[] = [];
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

    initialConnectors = res.rows.map((row) => ({
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
  } catch (err: any) {
    console.error(
      "[connectors page] Fetching initial connectors failed:",
      err.message
    );
  }

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">
          Integrations & Connectors
        </h1>
        <p className="text-slate text-sm leading-relaxed max-w-2xl">
          Connect your workspace to external services via MCP. Each connection
          uses your own OAuth grant — Rhea&apos;s agent discovers tools
          automatically and routes write operations through the Approver
          subagent.
        </p>
      </div>

      <ConnectorsClient initialConnectors={initialConnectors} user={session.user} />
    </div>
  );
}
