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

- T2 task chat merged into rhea-v2 after the review fixes (path-scoped harness permissions, "working" claim during runs, previewed tasks no longer demoted by a failed plan turn). EMPIRICALLY VERIFIED the HIGH fix: with a dummy `.env` in a parent dir, a headless run asked to read `../.env` was blocked (`permission_denials` recorded, nothing leaked) while reads inside `./shared/**` worked. Note from the fix: the real guard is permission mode `manual` (outside-cwd access prompts and is auto-denied headlessly); the `../**` deny rules are inert in this CLI version. F6 spot-check can be considered done.

- T9 per-assignment Vercel token built (feat/vercel-token, 129 tests) and T10 discard worktree cleanup + usage billing split built (feat/gaps-a, 100 tests); both under review. After these: secrets rotation endpoint, then a final whole-diff review of rhea-v2 vs main, then the final summary below.

- T9 Vercel token merged (38a05f4), review clean (token never in config/responses/errors; single decrypt path). T11 secrets rotation endpoint started in wt-2 (feat/secrets-rotation). T10 under review in wt-1.

- T10 merged (dc47b5c): soft discard now removes the task worktree (branch kept; uncommitted edits in that worktree are dropped, by design) and the Usage page splits billed API cost from subscription-covered tokens. T12 started in wt-1 (feat/task-revive): revive a discarded task (discarded -> planning, worktree re-created) + a /tasks history page with filters. T11 secrets rotation still building in wt-2.

- T11 secrets rotation merged (b6557e8), review clean (fails closed on corrupt ciphertext; rotated FTP pass used on next preview/publish). Minor note: the PATCH does not cross-check the key against the target type; the UI only sends the matching one. Waiting on T12, then the final whole-diff review.

## Morning summary (read this first)

### What got built overnight (all on `rhea-v2`, 49 commits ahead of `main`, typecheck clean, 158 tests passing)

1. **The Web Developer role now works end to end on your Claude Max login.** A real headless Claude Code run edited yogaessence, committed on a task branch, recorded usage, and resumed the same session for a second turn (T1). Default model is now `claude-sonnet-4-5` unless the assignment sets one (D4).
2. **Task chat (the client-facing UI).** Each Task is a headless session: `/assignments/<id>/tasks/<taskId>` has a chat with "Ask for a plan" (read-only, plan stored on the task) and "Make the change" (edits + commit), plus Build preview, Publish (sign-off), Discard. Endpoints: `POST /api/tasks/:id/message` (plan|edit), `GET .../messages`, `POST .../preview`, `POST .../publish`, `POST .../discard`, `POST .../revive`, `POST /api/tasks`.
3. **Isolation and safety.** Every Task runs in its own git worktree (no shared-checkout races). The harness is path-scoped to `siteDir` and cannot read `../.env` or write outside (empirically verified). Child env is allowlisted; Bash/WebFetch are never available. Publishing claims the task atomically; concurrent messages get 409.
4. **Tenancy.** New `CLIENT` role (request + preview + discard, never publish or manage). Assignments/Tasks/secrets are org-scoped everywhere.
5. **Secrets.** FTP password and Vercel token live encrypted in `secretsEnc`; redacted configs everywhere; `PATCH /api/assignments/:id/secrets` rotates them (OWNER/ADMIN).
6. **Pages.** `/assignments`, `/assignments/<id>`, task page, `/approvals` (everything waiting for sign-off), `/tasks` (history with filters + Revive for discarded), `/usage` (billed API cost vs subscription-covered tokens), `/roles`.
7. **Soft discard, fully.** Discard keeps the branch, frees the worktree; Revive brings it back (discarded -> planning, worktree re-created).
8. **Ops.** `Dockerfile.worker` + `fly.worker.toml` + `docs/deploy-worker.md` (image builds; entrypoint fixes the Fly volume ownership). `docs/telegram-channel.md` design (thin webhook first, no API key needed). Eve routing (`list_assignments` tool) ready for when an LLM key exists; subagents inherit orgId (verified in Eve dist).

### Decisions I made (veto any)
- D1 Web Developer runs on Claude Code headless (Max), not Eve's model. D2 task order as executed. D3 local merges only, nothing pushed. D4 default harness model sonnet 4.5.

### Flags for you: F1 to F6 above. Nothing was deployed, pushed, or sent anywhere.

### Morning verification checklist (10 minutes, no browser needed for the first three)
```bash
cd ~/Desktop/gitrepos/rhea && eval "$(fnm env)" && fnm use 24
docker start rhea-pg 2>/dev/null; npm run typecheck && npm test
git log --oneline main..rhea-v2 | head -60
```
Then (browser, your call): `npm run dev`, sign in as dev@local.test, open /assignments -> Yoga Essence Site -> a task -> try "Ask for a plan" (uses your Max login via the CLI engine: set `RHEA_HARNESS_ENGINE=cli` and `RHEA_HARNESS_AUTH=subscription` in `.env.local` first if not present).

CLI alternative for the same thing (dry-run, no deploy):
```bash
RHEA_HARNESS_ENGINE=cli RHEA_HARNESS_AUTH=subscription npx tsx scripts/run-task.ts --assignment 2fea37fe-650d-498b-9da2-b8e7eb7c6c7c --request "add a short welcome line under the hero heading in shared/7-points-of-mind-training-meditation-india.html" --harness --engine cli
```

### First real preview on Hostinger (only when you are ready)
Append `--deploy` to the command above, or click "Build preview" on the task page. It mirrors the task worktree's `shared/` to `/shared/preview/<branch-slug>/` on the live server and sets the task to previewed. Publish then copies to live after sign-off.

### When satisfied
`git push -u origin rhea-v2` (I did not push). The two worktrees `../rhea-wt-1` and `../rhea-wt-2` are detached at rhea-v2 and clean; remove with `git worktree remove ../rhea-wt-1 && git worktree remove ../rhea-wt-2`.

- Final whole-diff review (rhea-v2 vs main): no CRITICAL. Six HIGH, all one family (status-machine races): preview and discard did not claim the task atomically; a failed edit turn could leave a dirty worktree marked previewed; the Eve tools (edit_site/plan_changes/preview/publish/discard) bypassed the guards; plan_changes ran on the shared checkout. Fix in progress on feat/final-fixes (atomic claims everywhere, revert siteDir on failed edits, plan_changes on the task worktree). Everything else verified OK: harness scoping on all 5 call sites, worktree lifecycle, secrets never returned/logged, RBAC on all 12 changed routes, eve build 0 diagnostics, 158 tests.

- Final fixes merged: atomic status claims on preview/discard/message and on every Eve tool, siteDir reverted on failed edit turns, plan_changes runs on the task worktree. State at close: typecheck 0 errors, 163 tests passing, eve build 0 diagnostics, nothing pushed, nothing deployed. Both worktrees detached at rhea-v2 and clean.

- F7: yogaessence is a local git repo with NO GitHub remote, so the "open PR" step (open_pr tool / pushBranch) cannot run for it yet. When you want the GitHub half of the flow: create the repo (e.g. `gh repo create uniksquare/yogaessence --private --source ~/Desktop/gitrepos/yogaessence --push`) and set `repoUrl` on the assignment; everything else (branch per task, preview, publish) already works without a remote.
- Closing state (a268d04 + this): 54 commits ahead of main. Idle until morning; no further feature work started on purpose (remaining ideas are scheduled Roles like Code Reviewer/Monitor, which are a separate design).

- 2026-09-12: F7 resolved: yogaessence pushed to https://github.com/uniksquare/yogaessence (main + task branches) and the assignment repoUrl updated. rhea-v2 pushed and PR opened to main (not merged; local testing first, Neon before merge). No LLM key needed (Claude headless on Max).

- 2026-09-12 e2e through the real endpoints (dev login -> POST /api/tasks -> message plan -> message edit -> preview): all green on Max. Task 9a73eaea: plan returned structured edits + questions; edit committed a6d2072 in its worktree (one line added); FIRST REAL PREVIEW deployed to https://www.yogaessencerishikesh.com/shared/preview/task-9a73eaea/ (live page untouched). Ledger: 2 rows, sonnet, billing=subscription, cost 0.
- Three bugs found and fixed during this e2e (all committed): (1) lftp `-c` cannot be combined with `-u`/site on argv; commands now go over stdin like deploy.sh. (2) Preview mirrors copied the site's own .htaccess (RewriteBase /shared/) into the preview folder, which rewrote preview URLs to the live page; preview mirrors now exclude .htaccess and remove any copied one. (3) `roleLabel`/`formatDate` lived in a "use client" file and were called from server pages (runtime error you saw on /assignments/<id>); moved to lib/assignment-ui.ts.
