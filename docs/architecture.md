# rhea-v2: architecture

How the pieces fit together. See `docs/naming-and-concepts.md` first for the vocabulary (rhea = AI teammate, Role, Assignment, Task, Job description) used throughout this doc.

## Two runtimes, one database

rhea-v2 is a Next.js app (the cockpit UI and API routes) plus an Eve agent runtime (`npx eve dev`), both talking to a single Postgres database (Neon in the cloud, or a local Docker Postgres for dev). Prisma is the primary client for the platform tables (Role, Assignment, Task, UsageLedger, plus auth and incident tables). Everything that predates the Postgres migration (`lib/tenant.ts`, `agent/hooks/db-logger.ts`'s DynamoDB-shaped calls, and any other `queryDsql` call site) still runs, unmodified, through a small pg-Pool shim in `lib/db.ts`.

```
                 ┌───────────────────────────────┐
                 │      Next.js app (cockpit)     │
                 │  app/**, API routes, RBAC UI   │
                 └───────────────┬─────────────────┘
                                 │ Prisma
                                 ▼
                 ┌───────────────────────────────┐
                 │      Eve agent runtime         │
                 │  agent/agent.ts (router)       │
                 │   ├─ On-call Engineer flow     │
                 │   │   planner → investigator → │
                 │   │   sandbox → remediation →  │
                 │   │   approver                 │
                 │   └─ web-developer subagent    │
                 │       (Web Developer Role)     │
                 └───────────────┬─────────────────┘
                                 │ Prisma + pg-Pool shim
                                 ▼
                 ┌───────────────────────────────┐
                 │   Postgres (Neon or Docker)     │
                 │  roles, assignments, tasks,     │
                 │  usage_ledger, incidents, ...   │
                 └───────────────────────────────┘
```

### Why a raw pg-Pool shim next to Prisma

Prisma's `$queryRaw`/`$executeRaw` send bound parameters as `text`, and Postgres will not implicitly coerce `text -> uuid` (error `42804`). The pre-existing raw-SQL call sites (originally written against Aurora DSQL via `pg`) rely on Postgres inferring the column type - `text -> uuid`, `text -> jsonb`, etc. - from context, which only works when the driver sends the parameter untyped, the way `pg` does. Rather than rewrite every call site's SQL to add explicit casts, `lib/db.ts` keeps a small `pg.Pool` alongside the Prisma client and exposes `queryDb(text, params)` as a drop-in replacement for the old `queryDsql`. `lib/dsql.ts` is now a compatibility shim that re-exports `queryDb` as `queryDsql`, `prisma`, and `sanitizeDbResult`, so nothing importing from `@/lib/dsql` had to change. New code should prefer Prisma; reach for `queryDb` only when working with the legacy tables that still use raw SQL.

## Provider selection (`agent/model.ts`)

The Eve agent's brain is chosen once, by environment, in `agent/model.ts`:

- `ANTHROPIC_API_KEY` set → Anthropic (Claude) via `@ai-sdk/anthropic`.
- else `GOOGLE_VERTEX_API_KEY` or `GEMINI_API_KEY` set → Gemini via Vertex (`@ai-sdk/google-vertex`), with a `customFetch` wrapper that strips `functionCall.id`/`functionResponse.id` fields Vertex rejects on replayed tool calls.
- else → a boot-safe stub model (`MockLanguageModelV3`) that only throws once actually invoked, so the app can start with no LLM key configured at all.

This is the top-level Eve agent's model (used for the On-call Engineer flow and routing). The Web Developer Role runs a separate brain: the Claude Code harness (`lib/harness.ts`), invoked directly by the `web-developer` subagent's tools rather than through `agent/model.ts`. Per `docs/naming-and-concepts.md`, "both brains are welcome": Gemini/Vertex tends to orchestrate and converse, the Claude harness does the heavy code editing, and a Role picks whichever fits.

## Hooks

Eve hooks observe every event the runtime emits:

- `agent/hooks/db-logger.ts` - logs session/turn/tool-call/subagent lifecycle events, tenant-scoped by `orgId` from the session's auth attributes. Its storage calls are DynamoDB-shaped (`putItem`/`updateItem` against `lib/dynamodb.ts`); it has not been ported to the Postgres `hook_*` tables in `prisma/schema.prisma` yet, unlike the platform tables. Never throws (errors are caught and logged) so a logging failure never breaks a turn.
- `agent/hooks/usage-logger.ts` (if present in the build) - records per-step LLM token usage via `recordUsage` (`lib/platform.ts`) into `UsageLedger`, one row per `step.completed` event. Also tenant-scoped and non-throwing.

## The platform data model

See `prisma/schema.prisma`, section "Platform tables (rhea: Role / Assignment / Task / UsageLedger)".

- **Role** (`roles`) - the job description catalog. `roleKey` is the stable identifier ("web-developer", "on-call-engineer"); `manifest` (JSON) holds brain, workspace, playbooks, tools, and signoff requirements. Seeded by `lib/seed-roles.ts`.
- **Assignment** (`assignments`) - rhea doing one Role for one org: `roleKey` + `config` (JSON, repo/workspace/publish settings) + `secretsEnc` (AES-256-GCM ciphertext, never plaintext credentials in `config`). Scoped by `orgId`.
- **Task** (`tasks`) - one request-to-done run against an Assignment: `status`, `request`, `branch`, `previewUrl`, `prUrl`, `publishedUrl`, `plan` (JSON, from `plan_changes`). Scoped by `orgId` and indexed on `(orgId, assignmentId)`.
- **UsageLedger** (`usage_ledger`) - tokens and cost per `orgId`/`roleKey`/`tool`/`assignmentId`/`taskId`, so usage is always attributable to a tenant, Role, and Task.

`lib/platform.ts` is the only place allowed to read/write these tables, and the only function that ever returns decrypted secrets is `resolveAssignmentConfig` - its result must never be logged, persisted, or returned from a tool.

## Web Developer Role: Task flow

The `web-developer` subagent (`agent/subagents/web-developer/instructions.md`) owns one Assignment (one repo) per Task and moves it through:

```
request ──▶ plan_changes ──▶ edit_site ──▶ preview ──▶ [sign-off] ──▶ publish
                                  │                          │
                                  └──────────────▶ open_pr    └──▶ discard (soft)
```

1. **request** - the user's change, possibly a long spec/brief/ticket dump.
2. **plan_changes** (optional) - a read-only harness pass (`Read`/`Glob`/`Grep` only, ignores `config.allowedTools`) that returns `{ summary, edits, questions }` for the user to confirm before anything is touched.
3. **edit_site** - creates/resumes the Task, ensures the deterministic branch `task/<id8>` (the Task's UUID with non-alphanumerics stripped, first 8 chars), runs the Claude Code harness scoped to `siteDir`, and commits.
4. **preview** - `lib/previewer.ts` deploys the branch (lftp-mirrors to `<remoteDir>/preview/<slug(branch)>` for `hostinger-ftp`; Vercel not implemented yet) and records the preview URL; Task status becomes `previewed`.
5. **sign-off** - the subagent stops and reports the preview URL; it does not proceed to `publish` in the same turn. `open_pr` is available in parallel if the assignment wants a reviewable diff.
6. **publish** - only after explicit human approval, and only from a Task in status `previewed`. Publishing mirrors the site live (no `--delete`, so `preview/` is left intact) via `lib/publisher.ts`.
7. **discard** - a soft discard: Task status becomes `discarded`, but the branch and commits are kept in case the change is wanted later. Never allowed once a Task is `published`.

Every step reuses the same `taskId`. The branch name is deterministic and derived identically in `edit_site.ts`, `preview.ts`, `open_pr.ts`, `publish.ts`, and `scripts/run-task.ts`.

## Security posture

- **Org scoping** - every Assignment/Task read and write in `lib/platform.ts` is filtered by `orgId` from the authenticated session; a row belonging to another org is treated as not found, never as a permission error that leaks existence.
- **Secrets encrypted in `secretsEnc`** - `assignments.config` never contains credentials (`splitSecrets` in `lib/platform.ts` strips `publishTarget.pass` and any extra secrets before the row is written). They're AES-256-GCM encrypted (`lib/crypto.ts`) into `assignments.secrets_enc` and only decrypted inside `resolveAssignmentConfig`, which must never be logged or returned to a tool caller.
- **Harness env + tool allowlists** - `lib/harness.ts` runs Claude Code as a child process with a minimal allowlisted environment (`CHILD_ENV_ALLOWLIST`: no `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, etc.) and intersects any tenant-configured `allowedTools` with a server-side `SAFE_TOOLS` ceiling (`Read`, `Edit`, `MultiEdit`, `Write`, `Glob`, `Grep`) - tenant config can only narrow the tool set, never widen it (no `Bash`, no `WebFetch`).
- **lftp value validation** - `lib/previewer.ts`'s `assertSafeValue` rejects any host/port/path/user/pass value that could break out of the newline-delimited lftp script or its quoting (control characters, stray quotes/backslashes in paths, commas in the FTP user) before it is interpolated; credentials are passed to `lftp` via argv (`-u user,pass`), never inside the script text, and error output is masked to strip the credentials before it's ever thrown or logged.
- **Approvals via `always()`** - the `publish` tool sets `needsApproval: always()` (from `eve/tools/approval`), so every publish requires an explicit human approval gate regardless of what the subagent's own instructions say; the instructions treat that as a last line of defense, not the only check.
