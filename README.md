# 🌌 Rhea: Autonomous DevOps & Incident Response Agent

Rhea is an **Autonomous Incident Response & DevOps Agent** designed for multi-tenant, production-grade cloud environments. Built on top of the **Eve Framework** and powered by **Next.js** and **AWS Aurora DSQL**, Rhea acts as a durable, sandboxed engineer that automates the lifecycle of production incidents: from alerting and logs inspection to drafting, verifying, and executing hotfixes under human supervision.

---

## 🏗️ SaaS Architecture & Vision

Rhea combines secure sandbox boundaries with a durable model execution loop to safely run DevOps diagnostics and code mutations.

```mermaid
graph TD
    User([Platform User]) -->|Next.js Web UI / Slack| API[API Gateway & Auth]
    API -->|Multi-Tenant Routing| TenantRouter[Tenant Executor Service]
    TenantRouter -->|Spawn / Resume| AgentRunner[Durable Agent Engine]
    AgentRunner -->|Durable Session Hook| Dynamo[DynamoDB Operational State]
    AgentRunner -->|Audit & Memory| DSQL[Aurora DSQL Relational Memory]
    AgentRunner -->|Task Delegation| Sandbox[Firecracker VM Sandbox Pool]
    AgentRunner -->|Read / Write Metrics| Telemetry[Datadog / CloudWatch / Prometheus]
```

### 🛡️ Security & Sandbox Boundaries
Rhea runs potentially destructive diagnostics and fixes inside dedicated **Firecracker microVMs** or **gVisor container runtimes**.
*   **Zero-Trust Egress**: The sandboxed VM operates behind a domain-specific network proxy. Outbound traffic is restricted solely to authorized integration endpoints (e.g. `api.datadog.com`, `api.github.com`), completely blocking access to local subnet ranges and AWS link-local metadata endpoints (`169.254.169.254`).
*   **Credential Brokering**: Decrypted configuration credentials (like GitHub PATs or Datadog API keys) are injected into sandbox network request headers via secure proxy transformations rather than exposing raw secrets inside the guest VM environment.

---

## ⚡ Key Features

*   **Durable Incident Lifecycles**: Survives database connection dropouts, worker restarts, and network losses via Eve's durable execution framework.
*   **Relational Memory Engine**: Stores incident logs, investigated root causes, and successful remediation templates in an AWS Aurora DSQL database to dynamically match similar future failures.
*   **Multi-Tenant Cockpit**: A secure Next.js dashboard featuring organization settings, interactive agent chats, real-time log streams, and human-in-the-loop (HITL) approval gates.
*   **Extensive Connectors Hub**: Integrates with Datadog, Prometheus, GitHub, Slack, and AWS resources.

---

## 📂 Project Layout

The repository is structured logically to isolate backend agent logic, frontend UI views, and database interactions:

```
├── agent/                  # Core Eve Agent logic
│   ├── agent.ts            # Entry point; initializes the Gemini Vertex model
│   ├── instructions.md     # Operational lifecycle & execution instructions
│   ├── channels/           # Inbound/outbound communication interfaces
│   ├── connections/        # Connector authentication profiles
│   ├── subagents/          # Specialized task-specific agents
│   │   ├── planner/        # Formulates execution plans
│   │   ├── investigator/   # Executes logs/metrics diagnostics
│   │   ├── sandbox/        # Isolates unsafe command runs
│   │   ├── remediation/    # Proposes and drafts fixes
│   │   └── approver/       # Manages Human-In-The-Loop approval gates
│   └── tools/              # Custom agent tools (dsql connectors, bash, files)
│
├── app/                    # Next.js 15+ App Router UI Cockpit
│   ├── (dashboard)/        # Cockpit dashboard routes (connectors, incidents, chat)
│   ├── _components/        # Dashboard layout, charts, and messaging views
│   ├── api/                # Tenant-scoped API endpoints (alerts, team, sandboxes)
│   └── eve/v1/[...path]/   # Catch-all API proxy for the Eve agent local runtime
│
├── components/             # Reusable UI component primitives
├── lib/                    # Shared backend utilities
│   ├── auth.ts             # Auth.js / NextAuth configuration
│   ├── crypto.ts           # AES-256-GCM encryption/decryption helper
│   ├── dsql.ts             # Aurora DSQL postgres client adapter & IAM Token signer
│   ├── dynamodb.ts         # AWS DynamoDB client connection
│   └── init-db.ts          # Database migration & schema initialization script
│
├── demo-app/               # Sandbox test application containing common faults
└── package.json            # Node dependencies and project build scripts
```

---

## 🗄️ Relational Database Schema (Aurora DSQL)

Rhea uses AWS Aurora DSQL (PostgreSQL-compatible) for distributed multi-tenant memory. The tables are configured as follows:

| Table Name | Description | Key Fields |
| :--- | :--- | :--- |
| `organizations` | Tenant accounts partitioning data boundaries. | `org_id`, `name`, `created_at` |
| `users` | Admin & DevOps operators belonging to organizations. | `user_id`, `org_id`, `email`, `role`, `provider` |
| `api_keys` | API keys used for external webhooks/integrations. | `key_id`, `org_id`, `key_hash`, `scopes` |
| `incidents` | Tracks diagnostic status and current active sessions. | `incident_id`, `org_id`, `title`, `status`, `agent_session_state` |
| `investigations` | Incident findings, categories, and ranked potential causes. | `investigation_id`, `incident_id`, `ranked_causes`, `findings` |
| `root_causes` | Deconstructed details of discovered anomalies. | `cause_id`, `investigation_id`, `category`, `description`, `confidence` |
| `fix_patterns` | Relational memory templates linking issues to fixes. | `pattern_id`, `cause_category`, `remediation_template`, `success_rate` |
| `connector_instances` | Configuration and encryption keys for Datadog, Slack, etc. | `instance_id`, `org_id`, `connector_type`, `config_encrypted` |
| `sandbox_sessions` | Tracks active sandboxed VM limits and domain filters. | `session_id`, `org_id`, `allowed_domains`, `status` |
| `sandbox_executions` | Detailed stdout, stderr, and performance metrics audit trail. | `execution_id`, `session_id`, `command`, `exit_code`, `stdout`, `stderr` |

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js 24 (use [`fnm`](https://github.com/Schniz/fnm) to install and pin the version from `.node-version`).
*   A Neon Postgres `DATABASE_URL` (create a free project at [neon.tech](https://neon.tech)).
*   Optional: an `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` if you want to actually run the agent (not required just to boot the app).

### 2. Environment Variables
Create a `.env.local` file at the root of the project with the following configuration:
```env
# Database Configuration (Neon Postgres)
DATABASE_URL=postgresql://user:password@<endpoint>.neon.tech/dbname?sslmode=require

# Auth configuration & security keys
AUTH_SECRET=generate-a-secure-random-string
ENCRYPTION_KEY=32-character-encryption-key-for-AES

# OAuth Provider details (optional; each provider is only enabled when its
# ID + secret are both set, so you can leave these unset in local dev)
AUTH_GITHUB_ID=your-github-oauth-client-id
AUTH_GITHUB_SECRET=your-github-oauth-client-secret
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret

# Dev-only login bypass (never enable in production)
# Lets you sign in as a local dev user with no OAuth app configured.
AUTH_DEV_BYPASS=true
NEXT_PUBLIC_AUTH_DEV_BYPASS=true
```

### 3. Setup Dependencies & Initialize the Database
```bash
# Install NPM packages
npm install

# Push the Prisma schema to your Neon database
npm run db:push
```

### 4. Running the Development Environments
Start the Next.js local cockpit interface:
```bash
npm run dev
```

Start the Eve interactive agent server (runs the model loops, streams state, and serves local endpoints):
```bash
npx eve dev
```

With `AUTH_DEV_BYPASS=true` set, open the sign-in page and use the "Continue as dev user" option to skip GitHub/Google OAuth entirely.

---

## 🤝 Contributing & Code Review

Please review our [Contributing Guidelines](./CONTRIBUTING.md) and [Code Owners](./.github/CODEOWNERS) configuration prior to submitting Pull Requests.
All mutations and network egress changes require strict security verification before merging into the main branches.
