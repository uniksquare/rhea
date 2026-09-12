# Telegram as a channel: design spike

Status: spike, not implemented. Scope: adding Telegram as a way for a team member or client to drive rhea's Web Developer Role (Task flow) from a chat, without bypassing the RBAC and sign-off model in `docs/architecture.md`.

Read first: `docs/naming-and-concepts.md`, `docs/architecture.md`, `app/api/tasks/route.ts` (this branch has no `app/api/tasks/[id]/message/route.ts`, so Tasks are created via `POST /api/tasks` and driven onward through the `web-developer` subagent's own tools: `plan_changes`, `edit_site`, `preview`, `publish`, `discard`), `lib/rbac.ts`, `prisma/schema.prisma`, and `node_modules/eve/docs/channels/telegram.mdx` plus `node_modules/eve/docs/channels/overview.mdx`.

## 1. Two integration options

**Option A: Eve `telegramChannel` to the root agent.** `telegramChannel({ botUsername })` in `agent/channels/telegram.ts` mounts `POST /eve/v1/telegram`, checks `X-Telegram-Bot-Api-Secret-Token`, and routes chat into the Eve root agent (`agent/agent.ts`), the same runtime that drives the On-call Engineer flow. Per `docs/architecture.md`, that root agent's brain is selected in `agent/model.ts` and needs `ANTHROPIC_API_KEY` or `GOOGLE_VERTEX_API_KEY`/`GEMINI_API_KEY`; with neither set it falls back to a stub model that throws when invoked. A conversational Telegram experience through the root agent (free-form requests, the agent deciding which Task tool to call) is real product value, but it is gated on paying for an LLM key today, and it means teaching the root agent (or a new `telegram-developer` subagent) the same plan/edit/preview/publish tool surface the `web-developer` subagent already owns.

**Option B: a thin Telegram webhook, a plain Next.js route.** A new route, `app/api/telegram/webhook/route.ts`, receives Telegram updates directly (no Eve channel involved), maps `chat_id` to an org and a linked user, parses a small fixed command surface, and calls the exact same platform functions and API routes the cockpit UI already calls: `createTask` (via `POST /api/tasks`, same as the web UI), the `web-developer` subagent's `preview`/`publish`/`discard` tools, and `lib/rbac.ts` for permission checks. `lib/harness.ts` can run the Claude Code CLI engine against the operator's Claude Max login (`RHEA_HARNESS_ENGINE=cli`; the harness strips `ANTHROPIC_API_KEY` from the child env under this mode), so this path needs no LLM API key at all: it works today on a Max plan.

**Recommendation: build B first, revisit A later.** B reuses the exact Task state machine and RBAC gates already audited in `docs/architecture.md` (nothing new to trust), ships without a paid LLM key, and gives a fixed, reviewable command surface instead of free text reaching a model with tool access. A is worth doing once there is a reason for open-ended conversation (multi-turn planning, questions back to the user) rather than command dispatch; at that point A and B can coexist, since B's `telegram_links` table (below) is reusable as A's chat-to-org mapping too.

## 2. Data model

New table, `telegram_links` (Prisma model `TelegramLink`, snake_case columns to match the rest of `prisma/schema.prisma`):

| Column | Type | Notes |
| --- | --- | --- |
| `chat_id` | `varchar` | Telegram chat id, primary key. One row per linked chat (a group chat links once, to one org). |
| `org_id` | `uuid` | The org this chat is linked to. Never inferred, never defaulted. |
| `user_id` | `uuid` | The rhea `users` row the link was created for. |
| `role` | `varchar(50)` | Snapshot of the linking user's `Role` at link time (`lib/rbac.ts`), re-checked against `users.role` on every publish, not trusted stale. |
| `assignment_id` | `uuid` | Default Assignment for `/task` in this chat. |
| `created_at` | `timestamp` | |
| `linked_by` | `uuid` | The `user_id` who ran `/link`, for audit (may differ from `user_id` if a link is later reassigned). |

Link flow, one-time code:

1. On the Team page (`app/(dashboard)/team/team-client.tsx`), an OWNER/ADMIN/OPERATOR/CLIENT generates a short code (e.g. 6 alphanumeric characters) tied to their `user_id`, `org_id`, and a default `assignment_id`, stored server-side (new `telegram_link_codes` table or a short-lived row in Redis/Postgres) with a 10 minute expiry.
2. The user DMs the bot `/link <code>`.
3. The webhook looks up the code, checks it is unexpired and unused, and on success writes (or updates) the `telegram_links` row for that `chat_id`, marks the code consumed, and replies with confirmation naming the org and default Assignment.
4. Any other command from an unlinked `chat_id` is rejected with a message pointing at the Team page: unlinked chats are never defaulted to an org, so a stray group chat can never silently reach a tenant's Tasks.

## 3. Command surface

All commands operate on the chat's linked org, Assignment, and the linked user's role (re-checked live against `lib/rbac.ts`, not just the link's snapshot):

- `/task <request>`: `POST /api/tasks` with `{ assignmentId: link.assignmentId, request }`, using the same `requirePermission(role, "tasks:request")` gate the web UI's route already enforces. Replies with the new Task id.
- `/plan`: runs the read-only `plan_changes` pass against the chat's current Task and returns `{ summary, edits, questions }` as chat text.
- `/edit <msg>`: runs `edit_site` with `<msg>` as additional instruction on the current Task.
- `/preview`: runs the `preview` tool (`lib/previewer.ts`) and replies with the preview URL; Task status becomes `previewed`.
- `/status`: replies with the current Task's status, branch, and preview/publish URL if set.
- `/discard`: calls the same soft-discard path as `POST /api/tasks/[id]/discard` (`requirePermission(role, "tasks:discard")`); refused once a Task is `published`, exactly as the API route already refuses it.

`/plan`, `/edit`, `/preview`, `/status`, `/discard` all act on "the current Task", tracked as the chat's most recent open (non-`published`, non-`discarded`) Task; `/status` also accepts a Task id to disambiguate when a chat has none in flight.

Publish is never a typed command. After `/preview` succeeds, the bot sends an inline keyboard with a single "Publish" button, shown only when the link's live-checked role passes `hasMinRole(role, "ADMIN")`, matching the publish route's own gate. Tapping it calls `POST /api/tasks/[id]/publish` and edits the message in place to show the result, so the approval is a deliberate tap, not a typed word a script or autopilot could send.

Long harness runs (`/edit`, `/preview`) cannot block the webhook response: Telegram expects the webhook to return quickly. The route replies "Working on it..." immediately, kicks the harness run as a background job (reusing whatever async/queue mechanism the cockpit UI's own Task polling relies on), and sends a follow-up `sendMessage` (or `receive`-style proactive send per `telegram.mdx`) once the job completes or fails.

## 4. Security

- **Webhook secret**: every inbound request must carry `X-Telegram-Bot-Api-Secret-Token` matching `TELEGRAM_WEBHOOK_SECRET_TOKEN`; mismatches are rejected before any body parsing, same check `telegramChannel` itself performs.
- **New bot token required**: the existing controlroom Telegram bot credentials are scoped to the unikteam project, not rhea. Register a new bot via BotFather and store its token as `TELEGRAM_BOT_TOKEN` in rhea's own secrets, never reused across projects.
- **Per-link rate limits**: cap commands per `chat_id` per minute (in-memory or a small Postgres counter) to stop a compromised or looping chat from hammering the harness.
- **Message length caps**: inbound `/task`/`/edit` text is truncated or rejected past the same `REQUEST_MAX` (20000 chars) `app/api/tasks/route.ts` already enforces; outbound replies are split at Telegram's 4096 char limit as `telegram.mdx` describes.
- **No secrets in replies**: replies only ever include Task status, URLs, and summaries; `resolveAssignmentConfig`'s decrypted config (per `docs/architecture.md`) must never reach a chat message, matching the existing rule that it must never be logged or returned from a tool.
- **Audit trail**: every command writes a `usage_ledger` row via `recordUsage` (`lib/platform.ts`), tagged with the Task's `assignmentId`/`taskId` as usual, plus a new `task_messages` table (chat transcript per Task: `task_id`, `role` (user/bot), `body`, `created_at`, `source` = `telegram`) so a Task's history reads the same whether it was driven from the cockpit or from Telegram.

## 5. Group chats policy

Group chats may link, but only to a single org and a single default Assignment, exactly like a DM. Per `telegram.mdx`, group messages only reach the webhook when they are a command, an `@bot` mention, or a reply to the bot's own message, so ambient chat never triggers a Task. Publish still requires the tapping user's own linked role to pass ADMIN: a group's shared link inherits the role of whoever ran `/link`, so a group intended for non-admin use should be linked by an OPERATOR/CLIENT account, not an OWNER, to avoid handing every member in that chat an implicit publish button. A future refinement could resolve the tapping Telegram user id against their own `telegram_links` row instead of the chat's, but v1 keeps one role per chat to match the one-org-per-chat model.

## 6. Implementation plan

1. **Schema**: add `TelegramLink` and `TelegramLinkCode` models to `prisma/schema.prisma` (plus `task_messages` per section 4), run `db:push`, add accessor functions to `lib/platform.ts` (`getTelegramLink`, `createLinkCode`, `consumeLinkCode`, `appendTaskMessage`).
2. **Link code UI**: add a "Link Telegram" action to `app/(dashboard)/team/team-client.tsx` plus a small `POST /api/team/telegram-link-code` route that generates and returns the 10 minute code for the calling user.
3. **Webhook route**: `app/api/telegram/webhook/route.ts`, verifying the secret token, parsing updates, resolving `chat_id` to a `telegram_links` row (or handling `/link <code>`), and dispatching the command surface from section 3.
4. **Command handlers**: a small `lib/telegram/commands.ts` module that calls the existing platform functions (`createTask`, the `web-developer` subagent's tools, `updateTask`/discard path) rather than re-implementing Task logic, so behavior never drifts from the cockpit UI.
5. **Background execution**: wire `/edit` and `/preview` through whatever async runner already backs long Task operations (or a minimal job queue if none exists yet) so the webhook can return immediately and a follow-up `sendMessage` reports completion.
6. **Bot registration and rollout**: create the new rhea Telegram bot via BotFather, set `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET_TOKEN` in rhea's secrets (not shared with controlroom's unikteam bot), register the webhook URL with `setWebhook` per `telegram.mdx`, and enable for one pilot org before general availability.
