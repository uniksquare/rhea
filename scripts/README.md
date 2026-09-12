# scripts

Local drivers for the Web Developer libs (no Eve, no UI). Node 24: `export PATH="$HOME/.local/share/fnm:$PATH"; eval "$(fnm env)"; fnm use 24`.

1. Seed roles once: `npx tsx lib/seed-roles.ts`
2. Seed the Yoga Essence assignment (idempotent, reads FTP_* from `../yogaessence/.env`, stores the password encrypted): `npx tsx lib/seed-assignment-yogaessence.ts` and note the printed `assignmentId`.
3. Dry run (default; creates a Task, cuts `task/<id8>` in the workspace, prints the preview plan, no FTP, no LLM): `npx tsx scripts/run-task.ts --assignment <id> --request "smoke: no-op"`
4. Add `--harness` to run Claude Code on the request and commit `siteDir` (calls an LLM, records usage, stores the harness `sessionId` on the Task).
5. Add `--deploy` to actually lftp-mirror the site to `<remoteDir>/preview/<slug>` and mark the Task `previewed`.
6. If the workspace is not a git repo yet, the script runs `git init -b main` plus an initial commit there (local only, `.env` and `.DS_Store` ignored).
7. Inspect rows: `docker exec rhea-pg psql -U rhea -d rhea -c "select task_id, status, branch, preview_url, session_id from tasks order by created_at desc limit 5"`

## Engine, auth and multi-turn sessions

- `--engine sdk|cli` picks how the harness runs Claude Code. `sdk` uses `@anthropic-ai/claude-agent-sdk` (falls back to the CLI if the package is missing); `cli` spawns the installed `claude -p ... --output-format json` directly. Default comes from `RHEA_HARNESS_ENGINE` (`sdk` or `cli`, anything else means `sdk`).
- `RHEA_HARNESS_AUTH=subscription` drops `ANTHROPIC_API_KEY` from the child env so the run authenticates with the operator's Claude subscription login (`claude login`) instead of an API key. Any other value (or unset) forwards the key as before.
- `--resume <taskId>` reuses that Task instead of creating a new one: same `task/<id8>` branch and, when the Task has a stored `sessionId`, the harness continues that session (SDK `resume`, CLI `--resume <id>`). Each turn commits `siteDir` and records a usage row against the same Task, so a Task is a multi-turn headless session.
- Smoke test with the operator's Claude Max login (dry-run, no FTP):

  ```sh
  RHEA_HARNESS_ENGINE=cli RHEA_HARNESS_AUTH=subscription npx tsx scripts/run-task.ts \
    --assignment <id> --request "add <!-- rhea smoke --> as the first line of shared/sample.html" --harness --engine cli
  # then, on the printed task id:
  RHEA_HARNESS_ENGINE=cli RHEA_HARNESS_AUTH=subscription npx tsx scripts/run-task.ts \
    --assignment <id> --request "also add a second comment line" --harness --engine cli --resume <taskId>
  ```

  The `harness:` log line prints `engine=`, `session=` and (on resume) `resumed=true|false`. Ledger check: `docker exec rhea-pg psql -U rhea -d rhea -c "select tool, provider, model, input_tokens, output_tokens, cost_usd from usage_ledger order by created_at desc limit 3"`. Afterwards `git -C <workspace> checkout main`.
