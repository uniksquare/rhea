# Rhea Connection Marketplace

Welcome to the Rhea Connection Marketplace roadmap. This document outlines the integrations hub architecture and catalogues the installed and upcoming connectors that expand Rhea's autonomous incident diagnostics, alerts ingestion, and remediation capabilities.

---

## 1. Marketplace Architecture Vision
The **Rhea Connection Marketplace** will enable organizations to discover, install, and securely authorize third-party plugins in a self-service cockpit. 
- **Encryption Shield**: Every credentials configuration is encrypted at-rest using AES-256-GCM, tied to the organization's unique vault key.
- **Dynamic Capabilities**: Connectors publish capabilities (e.g. `logs:query`, `alerts:trigger`, `pr:create`) which are dynamically loaded as model-visible tools for the Investigator, Sandbox, and Remediation subagents.
- **Audit Trails**: Every API call executed by a connector is logged in AWS DynamoDB with full principal context and trace IDs.

---

## 2. Currently Configured Connectors (Phase 3)
These integrations are operational and tenant-isolated:
- **Datadog**: Observability logs, traces, APM database metrics, and alert triggers.
- **Prometheus**: Time-series system diagnostics (CPU, Memory, IO) using PromQL ranges.
- **Slack Webhook**: Inbound command executors and outbound approval gates.
- **GitHub API Gateway**: Safe workspace checkouts, fix patching, and Pull Request lifecycle management.

---

## 3. Future Connection Marketplace Catalog

### 🔍 Extended Observability & Tracing
- [ ] **Splunk / ElasticSearch**: Fetch high-volume historical audit logs and run full-text indexing queries to locate container failures.
- [ ] **Grafana Cloud**: Annotate live dashboards when Rhea starts/completes an investigation, and fetch dashboard layout panels for context gathering.
- [ ] **New Relic**: Ingest system warnings, error rate spikes, and map application profiles during diagnostics.
- [ ] **Dynatrace**: Access AI-detected problems, smartscape topologies, and event feeds.

### 🚨 Alert Ingestion & On-Call Routing
- [ ] **PagerDuty / Opsgenie**: Auto-spawn Rhea investigation sessions as soon as an alert fires, feeding raw on-call incident contexts directly to the planner.
- [ ] **Sentry / Bugsnag**: Sync error events with full stack-trace mapping, source map resolving, and link them to diagnostic files.

### ☁️ Cloud & Infrastructure Providers
- [ ] **AWS CloudTrail & IAM**: Trace control-plane API alterations to identify recent bad configuration changes and evaluate execution policy limits.
- [ ] **Google Cloud Operations (Stackdriver)**: Ingest GCP cluster, GKE namespaces, and GCE VM logs.
- [ ] **Azure Monitor**: Retrieve AKS (Azure Kubernetes Service) diagnostic records and cluster events.

### ⚙️ CI/CD & GitOps Remediations
- [ ] **ArgoCD / GitLab CI**: Trigger automatic rollbacks of faulty container deployments or trigger CI/CD retry jobs on pipeline errors.
- [ ] **Terraform Cloud**: Safe plan dry-runs and state modifications inside sandboxed VM execution environments.
- [ ] **Jenkins / CircleCI**: Check build logs for recent deployments to detect compile errors.

### 💬 Workspace Collaboration
- [ ] **Microsoft Teams**: Adaptive cards support for alert updates and approval buttons.
- [ ] **Discord Webhooks**: Outbound alerts and operational timeline broadcasts.
- [ ] **Jira / Linear**: Automatically create incident-linked tracking tickets and update issues upon resolution.
