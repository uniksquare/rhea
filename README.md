# 🌌 Rhea: AI Teammate Platform

Rhea is an **AI teammate**: put it in a **Role**, give it an **Assignment**, and it completes **Tasks** from request to done. Built on the **Eve Framework** and **Next.js**, with a single Postgres database (Neon or local Docker) via Prisma.

Incident response is one Role (**On-call Engineer**: investigate, remediate, notify, all under human sign-off). Editing and publishing a client's site is another (**Web Developer**: edit, preview, publish, also under human sign-off). More Roles - App Developer, Code Reviewer, Monitor, Researcher - follow the same shape: a job description of brain, workspace, playbooks, tools, sign-off, and settings/keys, filled in differently per Role.

Every Task moves through the same arc: **request → plan → preview/proposal → human sign-off → publish/execute**. Nothing that mutates a live system happens without explicit approval, and every Task is auditable: its own thread, its own artifacts (branch/preview/patch), and recorded usage (tokens + cost) per tenant, Role, and Task.

Read more:
- [`docs/naming-and-concepts.md`](docs/naming-and-concepts.md) - the shared vocabulary (rhea, Role, Assignment, Task, Job description) and the Role catalog.
- [`docs/architecture.md`](docs/architecture.md) - how the Next app and Eve runtime fit together, the platform data model, and the Web Developer Task flow.
- [`docs/roles/web-developer.md`](docs/roles/web-developer.md) - the Web Developer Role's job description, config, and operator commands.
- [`docs/adding-a-role.md`](docs/adding-a-role.md) - the checklist for teaching rhea a new Role.

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
