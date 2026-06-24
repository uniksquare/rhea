# Contributing to Rhea

Thank you for your interest in contributing to Rhea, the Autonomous Incident Response & DevOps Agent! This guide details the development process, coding standards, and security policies required to keep Rhea robust, secure, and production-grade.

---

## 🚀 Development Setup

### 📋 Prerequisites

Ensure you have the following installed on your machine:
*   **Node.js**: `v24.x` (or newer)
*   **Package Manager**: `npm` (packaged with Node.js) or `pnpm`
*   **Database**: Access to an **AWS Aurora DSQL** cluster (PostgreSQL-compatible)
*   **AWS CLI & Credentials**: Configured with permissions to access DynamoDB and Aurora DSQL.

### 🛠️ Environment Configuration

1.  Copy the environment template file to create `.env.local`:
    ```bash
    cp .env.example .env.local
    ```
2.  Provide the required environment variables:
    *   `DATABASE_URL`: PostgreSQL connection string (configured for Aurora DSQL)
    *   `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: Credentials for DynamoDB and DSQL signing.
    *   `AWS_REGION`: Defaults to `ap-south-1`.
    *   `GEMINI_API_KEY` / `GOOGLE_VERTEX_API_KEY`: API key for model reasoning.
    *   `AUTH_SECRET`: Secret used for encryption and session signing.
    *   `AUTH_GITHUB_ID` & `AUTH_GITHUB_SECRET`: For GitHub OAuth integration.
    *   `AUTH_GOOGLE_ID` & `AUTH_GOOGLE_SECRET`: For Google OAuth integration.

### 📦 Installation & Initial Setup

Install the project dependencies:
```bash
npm install
```

Initialize your database schema by running the initialization script:
```bash
# This creates all necessary tables in your Aurora DSQL cluster and seeds the default organization.
npx tsx lib/init-db.ts
```

### 💻 Running Locally

To run the Next.js development cockpit:
```bash
npm run dev
```

To run the Eve agent in local interactive terminal UI mode (TUI):
```bash
npx eve dev
```

---

## 📐 Coding Standards

### 🧬 Framework Conventions
Rhea is built on the **Eve Framework**, a filesystem-first framework for durable agents.
*   **Agents**: Configured inside `agent/agent.ts` using `defineAgent`.
*   **Instructions**: The core agent's prompt lives in `agent/instructions.md`.
*   **Subagents**: Specialized task-delegation child agents are authored under `agent/subagents/`.
*   **Tools**: Custom tools are defined in `agent/tools/` using `defineTool`. Name these files in `snake_case`.

### ⚛️ Frontend Conventions (Next.js & Styling)
*   Use Next.js 15+ **App Router** features.
*   Use **Vanilla CSS** (defined in `app/globals.css` and local modular stylesheets) for maximum layout flexibility.
*   Avoid adding inline utility classes unless necessary.
*   Prefer premium aesthetics, modern typography, glassmorphism, and responsive CSS grid/flexbox layouts.

### 🔒 Security & Sandboxing Rules
Rhea executes untrusted commands inside isolated environments.
*   **Zero-Trust Sandbox**: Any system command must run inside the sandbox. Never invoke `exec` or write files directly on the agent host machine.
*   **Egress Network Security**: Ensure egress proxies inside `agent/subagents/sandbox/sandbox.ts` only allow connections to validated endpoints (e.g. `api.github.com`, `datadog.com`). All other local network, AWS metadata (e.g. `169.254.169.254`), and RFC1918 subnets must be strictly blocked.
*   **Credentials Encryptions**: All integrations credentials stored in the database must be encrypted using `AES-256-GCM` via `lib/crypto.ts`. Never log decrypted secrets.

---

## 🪵 Database Logging

Rhea maintains a complete audit trail and relational memory history inside Aurora DSQL. When modifying agent steps:
*   Ensure every diagnostic discovery is logged via `db_incident` tool using `log_investigation`.
*   Ensure every remediation proposal is logged via `db_incident` tool using `log_fix_pattern`.
*   Ensure incident resolution updates the status in the `incidents` table.

---

## 🌿 Branching & Pull Request Process

### 🎋 Branching Strategy
*   Feature branches must be created off of `production` or `master` depending on release scope.
*   For active development on connectors, use the `connectors-v1` branch.
*   Use descriptive branch names: `feature/datadog-connector`, `bugfix/sandbox-egress-leak`.

### 📝 Commit Message Convention
We adhere to **Conventional Commits**:
*   `feat: add Dynatrace observability connector`
*   `fix: update AWS subnet egress blocks`
*   `docs: document DSQL schema migration`
*   `refactor: optimize token caching for DSQL signer`

### 🔍 Code Review Checklist
Before submitting a PR for review, ensure:
1.  **Typecheck Passes**: Run `npm run typecheck` and verify there are no TypeScript compile errors.
2.  **Build Completes**: Confirm the application builds cleanly with `npm run build`.
3.  **No Leaked Secrets**: Check that no credentials or keys are hardcoded in source code or committed to `.env` files.
4.  **Sandbox Isolation**: Any tool running command executions must delegate to the Eve sandbox instead of running host process commands.
