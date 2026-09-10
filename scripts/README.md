# scripts

Local drivers for the Web Developer libs (no Eve, no UI). Node 24: `export PATH="$HOME/.local/share/fnm:$PATH"; eval "$(fnm env)"; fnm use 24`.

1. Seed roles once: `npx tsx lib/seed-roles.ts`
2. Seed the Yoga Essence assignment (idempotent, reads FTP_* from `../yogaessence/.env`, stores the password encrypted): `npx tsx lib/seed-assignment-yogaessence.ts` and note the printed `assignmentId`.
3. Dry run (default; creates a Task, cuts `task/<id8>` in the workspace, prints the preview plan, no FTP, no LLM): `npx tsx scripts/run-task.ts --assignment <id> --request "smoke: no-op"`
4. Add `--harness` to run Claude Code on the request and commit `siteDir` (calls an LLM, records usage).
5. Add `--deploy` to actually lftp-mirror the site to `<remoteDir>/preview/<slug>` and mark the Task `previewed`.
6. If the workspace is not a git repo yet, the script runs `git init -b main` plus an initial commit there (local only, `.env` and `.DS_Store` ignored).
7. Inspect rows: `docker exec rhea-pg psql -U rhea -d rhea -c "select task_id, status, branch, preview_url from tasks order by created_at desc limit 5"`
