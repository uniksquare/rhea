import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { queryDsql } from "@/lib/dsql";
import { decrypt } from "@/lib/crypto";
import { ConnectorsClient } from "./connectors-client";

export default async function ConnectorsPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;

  // Retrieve existing configured integrations
  let initialConnectors: any[] = [];
  try {
    const res = await queryDsql(
      `SELECT instance_id, connector_type, display_name, config_encrypted, status, last_health_check, created_at
       FROM connector_instances
       WHERE org_id = $1
       ORDER BY created_at DESC;`,
      [orgId]
    );

    initialConnectors = res.rows.map((row) => {
      let config: Record<string, any> = {};
      try {
        if (row.config_encrypted) {
          const decrypted = decrypt(row.config_encrypted);
          config = JSON.parse(decrypted);
        }
      } catch (err: any) {
        console.error(`[connectors page] Decryption failed for instance ${row.instance_id}:`, err.message);
      }

      // Mask sensitive credential properties
      const maskedConfig: Record<string, any> = {};
      for (const [key, value] of Object.entries(config)) {
        const isSensitive = /key|token|secret|password/i.test(key);
        if (isSensitive && typeof value === "string") {
          maskedConfig[key] = "••••••••••••";
        } else {
          maskedConfig[key] = value;
        }
      }

      return {
        instanceId: row.instance_id,
        connectorType: row.connector_type,
        displayName: row.display_name,
        status: row.status,
        lastHealthCheck: row.last_health_check,
        createdAt: row.created_at,
        config: maskedConfig,
      };
    });
  } catch (err: any) {
    console.error("[connectors page] Fetching initial connectors failed:", err.message);
  }

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Integrations & Connectors</h1>
        <p className="text-slate text-sm leading-relaxed max-w-2xl">
          Connect your incident response workspace to Datadog, Prometheus, Slack, and GitHub. Rhea subagents consume these channels to auto-investigate alerts and apply remedies safely.
        </p>
      </div>

      <ConnectorsClient initialConnectors={initialConnectors} user={session.user} />
    </div>
  );
}
