# Rhea Connection Marketplace

Welcome to the Rhea Connection Marketplace. This document outlines Rhea's remote Model Context Protocol (MCP) connector architecture, our security posture, and the catalog of active integrations.

---

## 1. Managed MCP + OAuth Architecture
The **Rhea Connection Marketplace** allows organizations to securely connect external systems via remote MCP servers. 
- **OAuth 2.1 via Vercel Connect**: Rhea uses `@vercel/connect` for interactive user authentication. Credential storage, consent flow, and token refreshes are handled securely by Vercel Connect.
- **No Stored Keys**: Rhea does not store third-party credentials or API keys. Tokens are resolved dynamically at runtime and are cached only for the duration of active execution steps.
- **Write Approval Safety Gate**: Any mutating tool call (e.g., creating a GitHub PR, updating a PagerDuty alert, posting a Slack message, scaling AWS resources) must go through the **Approver** subagent for human-in-the-loop validation.

---

## 2. Active Connectors (MCP-Based)
These connectors are operational and integrated into Rhea:

| Service | MCP URL / Type | Purpose & Capabilities |
|---------|----------------|------------------------|
| **Sentry** | `https://mcp.sentry.dev/sse` | Exception tracking, query stack traces, release health, and assign/resolve issues. |
| **Datadog** | `https://mcp.datadoghq.com/sse` | Query logs, APM traces, system metrics, dashboard metadata, and mute monitors. |
| **GitHub** | `https://api.githubcopilot.com/mcp/` | Search repos, read code files, manage branch/commit lifecycle, and open/merge pull requests. |
| **AWS** | `https://mcp.amazonaws.com` | Check CloudWatch logs, describe EKS pods/clusters, inspect EC2 instances, and audit events via CloudTrail. |
| **Slack** | `https://mcp.slack.com/sse` | Search communication history, read channels, post incident logs, and coordinate response. |
| **Linear** | `https://mcp.linear.app/sse` | List and create tracking tickets, query cycle progress, and add comments to active incident issues. |
| **PagerDuty** | `https://mcp.pagerduty.com/mcp` | List incident alerts, check on-call schedules, query services, and acknowledge/resolve alerts. |

---

## 3. Future Integrations Roadmap

### 🔍 Extended Observability & Tracing
- [ ] **Splunk / ElasticSearch**: Fetch high-volume historical audit logs and run full-text indexing queries.
- [ ] **Grafana Cloud**: Annotate live dashboards when Rhea starts/completes an investigation.
- [ ] **New Relic**: Ingest system warnings, error rate spikes, and map application profiles during diagnostics.

### ⚙️ CI/CD & GitOps Remediations
- [ ] **ArgoCD / GitLab CI**: Trigger automatic rollbacks of faulty container deployments or trigger CI/CD retry jobs.
- [ ] **Terraform Cloud**: Safe plan dry-runs and state modifications inside sandboxed VM execution environments.

---

## 4. Vercel Connect Client Registration Steps

To configure authorization for any of the 7 supported connectors, register a Connect client in the Vercel dashboard:

1. **Navigate to Project Settings**:
   Go to **Vercel Dashboard → Your Project → Settings → Connect**.

2. **Add Provider**:
   Click **Add Provider** for each service and configure using the respective Client UID:
   - **Sentry**: UID=`sentry`, register OAuth App under Sentry Account Settings.
   - **Datadog**: UID=`datadog`, register OAuth App under Datadog Organization Settings.
   - **GitHub**: UID=`github`, register Developer OAuth App under GitHub Settings.
   - **AWS**: UID=`aws`, configure Cognito/IAM authorization broker.
   - **Slack**: UID=`slack`, register app under Slack API Portal.
   - **Linear**: UID=`linear`, configure Linear OAuth 2.1 parameters.
   - **PagerDuty**: UID=`pagerduty`, register app under PagerDuty App Registration.

3. **Set Callback URL**:
   Set the Redirect/Callback URL in the provider's settings to:
   `https://<your-custom-domain>/api/auth/callback/connect`

4. **Add Provider Credentials**:
   Copy the provider's Client ID and Client Secret into the Vercel Connect settings pane.

5. **Provide Secret**:
   Generate and configure `VERCEL_CONNECT_SECRET` in your `.env.local` or environment variables settings.

