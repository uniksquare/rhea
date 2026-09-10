# Handover (overnight autonomous run, started 2026-09-11)

Read this first. It is updated after every loop iteration. Newest notes at the bottom of each section.

## What you (Soubhagya) want to build, in one paragraph

rhea is an **AI teammate** for the Uniksquare team and invited agency-client tenants (not public). It works in **Roles**, is given **Assignments** (a Role bound to one client/repo with its own settings and encrypted keys), and completes **Tasks** from request to done. The first Role is **Web Developer**: a client or teammate describes a change (or pastes a long doc), rhea studies it and proposes a plan, makes the change on a git branch, deploys a **preview URL**, and after human **sign-off** publishes to production (Hostinger FTP for yogaessence; Vercel for Vercel-hosted sites). **Discard is soft** (branch kept, revivable). Every Task is auditable with **token usage and cost per tenant, role, and task**. The brain for code work is **Claude Code headless on your Max plan** (no API key); chat orchestration through Eve (Gemini) exists but is not on the critical path. Incident response is just one Role among many; more Roles (App Developer, Code Reviewer, Monitor, Researcher) come later, each a folder plus a job description. Telegram is a later channel. Nothing is tested in a browser; verification is typecheck, unit tests, CLI dry-runs, and Eve build diagnostics.

## Ground rules I am following

- Two git worktrees, two parallel tasks max: `../rhea-wt-1` and `../rhea-wt-2`, each on a `feat/*` branch off `rhea-v2`.
- Per task: build -> typecheck + tests -> reviewer -> fix -> re-verify -> merge into `rhea-v2` (local merge, no push).
- No browser. No `--deploy` to the live Hostinger folder. No `git push`. No questions to you; decisions are logged below.
- If a usage limit hits, I wait for the reset and continue.

## Decisions made without you (please confirm or veto tomorrow)

- D1: Web Developer conversations run as **headless Claude Code sessions on Max** (one session per Task, resumed per message), not through Eve's model. Eve routing to the subagent is deprioritized to last (needs an API key to exercise).
- D2: Task order: harness e2e -> client RBAC -> task chat endpoint + task page chat -> worktree per task -> plan/edit/preview via chat -> approvals inbox -> Fly worker image -> Telegram design doc -> Vercel per-assignment token -> gap features.
- D3: Merges into `rhea-v2` are local only. You decide when to push.

## Flags for you

- F1: Max headless is fine for internal use; if agency clients hammer it, Max rate limits and Anthropic's personal-use terms apply. Drop-in fix later: `ANTHROPIC_API_KEY` in `.env.local`, no design change.
- F2: Nothing has been deployed to Hostinger. When you want a real preview on the live server, run `npx tsx scripts/run-task.ts --assignment 2fea37fe-650d-498b-9da2-b8e7eb7c6c7c --request "..." --harness --deploy` yourself, or tell me "deploy ok".
- F3: `siteDir: "."` is allowed for assignments whose workspace is under `RHEA_WORKSPACE_ROOTS`. Say if you want the workspace root itself to be un-mirrorable.

## Status log (newest last)

- 2026-09-11 start: `rhea-v2` at `e67830f`, typecheck 0 errors, 45/46 tests. Queue above. Starting T1 (harness e2e, real Claude via CLI on Max, dry-run) and T5 (client RBAC) in parallel.

- T5 client RBAC: built, reviewed clean, merged into rhea-v2 (e18c2db). wt-2 now on feat/worktree-per-task (T4).

- T1 harness e2e: SUCCESS. Claude Code headless via the CLI engine on your Max login edited yogaessence (`shared/sample.html`), committed on `task/51068036` (2 turns, session resumed), ledger rows recorded. Branch feat/harness-e2e under review, then merge.
- F4: under `RHEA_HARNESS_AUTH=subscription` the ledger's `cost_usd` is the CLI's *nominal* API-equivalent price, not what you pay (Max covers it). Follow-up queued: record `billing=subscription` and cost 0 for those runs so the Usage page does not overstate spend.
- F5: the harness defaulted to `claude-opus-5[1m]`, which eats Max quota fastest. Decision D4 (mine, veto if you disagree): default the edit harness to `claude-sonnet-4-5` unless the assignment sets `model`; plan_changes stays cheap too. Queued as a follow-up on the harness branch.
- Gap queued: `scripts/run-task.ts` still uses the shared checkout (ensureBranch); switch it to `resolveTaskWorkspace` once T4 merges.

- T1 merged into rhea-v2 (6861649) after review; LOW finding fixed (resume session id validated). T4 worktree-per-task built (feat/worktree-per-task) and under review. T7 Fly worker image started in wt-1 (feat/fly-worker). T2 task chat waits for T4 merge (it uses lib/worktree.ts).

- T4 merged into rhea-v2 (e911783) after fixing 2 MED review findings (worktree call now fails the task cleanly; branch-already-checked-out in the shared workspace is handled by moving a clean shared checkout back to base). T2 task chat started in wt-2 (feat/task-chat): chat endpoint + task page + plan/edit modes + task_messages table + default harness model sonnet (D4) + subscription billing in ledger (F4) + run-task on worktrees. T7 Fly image still building in wt-1.

- T7 Fly worker image merged (53e8e46) after fixing a HIGH: Fly volume at /data is root-owned on first boot, so an entrypoint now chowns it and drops to the rhea user via gosu (verified in a container). T2 task chat built (feat/task-chat, 105 tests) and under review. T6 approvals inbox started in wt-1.

- T2 task chat review: HIGH found and being fixed: the harness's Read/Edit/Write were not path-scoped, so a client message could make it read `../../../.env` from the task worktree or write outside siteDir. Fix: Claude Code permission rules with path qualifiers (`Edit(./<siteDir>/**)` etc.), deny rules for `../`, `~/`, `.env*`, and permissionMode "default" so anything outside is denied headlessly. Also adding a "working" task status claim so concurrent messages/publishes cannot collide (MEDIUM), and a plan-turn failure no longer demotes a previewed task (LOW).
- F6: the same path-scoping gap existed in the Eve tool path (edit_site/plan_changes) before tonight; the fix covers both since all go through runHarness. Worth a manual spot-check tomorrow: run a plan turn asking to "read ../../../.env" and confirm it is refused.
- T6 approvals inbox built (feat/approvals-inbox, 93 tests) and under review.

- T6 approvals inbox merged (4eb8f13), review clean. T8 Telegram design doc started in wt-1 (feat/telegram-design). T2 fix (path-scoped harness permissions + working-status claim) in progress in wt-2.

- T8 Telegram design doc merged (f99488d): recommends a thin webhook mapping chats to tenants (works on Max, no API key) before the Eve telegramChannel option. Eve routing task (list_assignments tool + router prompt) started in wt-1 (feat/eve-routing). T9 Vercel token queued behind the T2 merge (both touch lib/platform.ts).

- Eve routing merged (list_assignments + router prompt; eve build 0 diagnostics). Finding: Eve subagents inherit parent auth incl. orgId (dist evidence in the worker report), so the web-developer subagent works under the Eve chat once an LLM key exists. wt-1 now on feat/gaps-a (discard cleans its worktree; Usage page shows billing).
