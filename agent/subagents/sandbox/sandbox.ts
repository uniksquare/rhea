import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";
import { queryDsql } from "../../../lib/dsql";
import { decrypt } from "../../../lib/crypto";

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

    // 2. Fetch Active Connector Instances
    const res = await queryDsql(
      "SELECT connector_type, display_name, config_encrypted FROM connector_instances WHERE org_id = $1 AND status = 'ACTIVE';",
      [orgId]
    );

    // 3. Build Dynamic Egress Network Policy & Credential Broker Transforms
    const allowedDomains: string[] = ["github.com", "api.github.com"];
    const transforms: Record<string, any[]> = {};

    for (const row of res.rows) {
      try {
        const decrypted = decrypt(row.config_encrypted);
        const config = JSON.parse(decrypted);

        if (row.connector_type === "datadog") {
          const site = config.site || "datadoghq.com";
          allowedDomains.push(site);
          allowedDomains.push(`api.${site}`);

          transforms[`api.${site}`] = [
            {
              transform: [
                {
                  headers: {
                    "DD-API-KEY": config.apiKey || "",
                    "DD-APPLICATION-KEY": config.appKey || "",
                  },
                },
              ],
            },
          ];
        } else if (row.connector_type === "prometheus") {
          const urlStr = config.url;
          if (urlStr) {
            const parsedUrl = new URL(urlStr);
            allowedDomains.push(parsedUrl.hostname);
            if (parsedUrl.port) {
              allowedDomains.push(`${parsedUrl.hostname}:${parsedUrl.port}`);
            }
          }
        } else if (row.connector_type === "github") {
          const pat = config.personalAccessToken;
          if (pat) {
            const basicAuth = Buffer.from(`x-access-token:${pat}`).toString("base64");
            const headerObj = { transform: [{ headers: { authorization: `Basic ${basicAuth}` } }] };
            transforms["api.github.com"] = [headerObj];
            transforms["github.com"] = [headerObj];
          }
        } else if (row.connector_type === "slack") {
          const botToken = config.botToken;
          if (botToken) {
            allowedDomains.push("slack.com");
            allowedDomains.push("hooks.slack.com");
            const headerObj = { transform: [{ headers: { authorization: `Bearer ${botToken}` } }] };
            transforms["slack.com"] = [headerObj];
            transforms["hooks.slack.com"] = [headerObj];
          }
        }
      } catch (err: any) {
        console.error(`[sandbox.ts] Failed to decrypt or parse connector:`, err.message);
      }
    }

    const uniqueDomains = Array.from(new Set(allowedDomains));
    const allowConfig: Record<string, any[]> = {};
    for (const domain of uniqueDomains) {
      allowConfig[domain] = transforms[domain] || [];
    }

    // 4. Initialize Sandbox with Zero-Trust firewall and subnets blocks
    const sandbox = await use({
      networkPolicy: {
        allow: allowConfig,
        subnets: {
          deny: [
            "10.0.0.0/8",      // RFC1918 Class A
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

