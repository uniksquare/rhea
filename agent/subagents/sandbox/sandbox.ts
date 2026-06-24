import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";
import { queryDsql } from "../../../lib/dsql.ts";

export default defineSandbox({
  backend: vercel({
    runtime: "node24",
    resources: { vcpus: 4 },
  }),

  async onSession({ use, ctx }) {
    // 1. Resolve Tenant Context
    const user = ctx.session?.auth?.current;
    if (!user) {
      // Default to deny-all isolation if not authenticated
      await use({ networkPolicy: "deny-all" });
      return;
    }

    const orgId = user.attributes?.orgId;
    if (!orgId) {
      await use({ networkPolicy: "deny-all" });
      return;
    }

    // 2. Fetch Active MCP Connector Instances to build egress policy
    const res = await queryDsql(
      "SELECT connector_type, display_name, mcp_url FROM connector_instances WHERE org_id = $1 AND status = 'ACTIVE';",
      [orgId]
    );

    // 3. Build Dynamic Egress Network Policy
    // MCP connections handle auth via Vercel Connect — no credential injection needed.
    // We only need to allow egress to the MCP server domains.
    const allowedDomains: string[] = [
      "github.com",
      "api.github.com",
    ];

    // Map of MCP connector types to their required egress domains
    const connectorDomains: Record<string, string[]> = {
      sentry: ["mcp.sentry.dev", "sentry.io"],
      datadog: ["mcp.datadoghq.com", "datadoghq.com", "api.datadoghq.com"],
      github: ["api.githubcopilot.com", "github.com", "api.github.com"],
      aws: ["mcp.amazonaws.com", "amazonaws.com"],
      slack: ["mcp.slack.com", "slack.com", "hooks.slack.com"],
      linear: ["mcp.linear.app", "api.linear.app"],
      pagerduty: ["mcp.pagerduty.com", "api.pagerduty.com", "identity.pagerduty.com"],
    };

    for (const row of res.rows) {
      const domains = connectorDomains[row.connector_type];
      if (domains) {
        allowedDomains.push(...domains);
      }
      // Also allow the raw MCP URL domain
      if (row.mcp_url) {
        try {
          const url = new URL(
            row.mcp_url.startsWith("http") ? row.mcp_url : `https://${row.mcp_url}`
          );
          allowedDomains.push(url.hostname);
        } catch {
          // Skip malformed URLs
        }
      }
    }

    const uniqueDomains = Array.from(new Set(allowedDomains));
    const allowConfig: Record<string, any[]> = {};
    for (const domain of uniqueDomains) {
      allowConfig[domain] = [];
    }

    // 4. Initialize Sandbox with Zero-Trust firewall and subnet blocks
    const sandbox = await use({
      networkPolicy: {
        allow: allowConfig,
        subnets: {
          deny: [
            "10.0.0.0/8",       // RFC1918 Class A
            "172.16.0.0/12",    // RFC1918 Class B
            "192.168.0.0/16",   // RFC1918 Class C
            "169.254.169.254/32" // AWS Link-Local Instance Metadata
          ]
        }
      }
    });

    // 5. Log Sandbox Session Start
    try {
      await queryDsql(
        `INSERT INTO sandbox_sessions (session_id, org_id, user_id, status, allowed_domains, config_limits)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
         ON CONFLICT (session_id) DO UPDATE 
         SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP;`,
        [
          sandbox.id,
          orgId,
          user.principalId,
          JSON.stringify(uniqueDomains),
          JSON.stringify({ memoryMiB: 2048, vcpus: 4 })
        ]
      );
    } catch (err: any) {
      console.error("[sandbox.ts] Failed to log sandbox session:", err.message);
    }

    // 6. Instrument execution logging (run wrapper)
    if (typeof sandbox.run === "function") {
      const originalRun = sandbox.run.bind(sandbox);
      (sandbox as any).run = async (options: { command: string }) => {
        const startTime = new Date();
        let status = "SUCCESS";
        let errorMsg = null;
        let stdout = "";
        let stderr = "";

        try {
          const result = await originalRun(options);
          stdout = result.stdout || "";
          stderr = result.stderr || "";
          return result;
        } catch (err: any) {
          status = "FAILED";
          errorMsg = err.message;
          stderr = err.stderr || err.message;
          throw err;
        } finally {
          try {
            const duration = Date.now() - startTime.getTime();
            await queryDsql(
              `INSERT INTO sandbox_executions (session_id, command, status, exit_code, stdout, stderr, execution_time_ms)
               VALUES ($1, $2, $3, $4, $5, $6, $7);`,
              [
                sandbox.id,
                options.command,
                status,
                status === "SUCCESS" ? 0 : 1,
                stdout.substring(0, 5000),
                (stderr || errorMsg || "").substring(0, 5000),
                duration
              ]
            );
          } catch (dbErr: any) {
            console.error("[sandbox.ts] Failed to log command execution:", dbErr.message);
          }
        }
      };
    }
  }
});
