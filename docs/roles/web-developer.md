# Role: Web Developer

## Job description, in plain language

rhea in the Web Developer Role edits one assigned website repo, previews the change, and publishes only after a human signs off. It is always scoped to a single Assignment (one repo, one `assignmentId`) and never touches any other repo.

**What it needs**

- A Git repo checkout on disk (`workspacePath`) with the site inside a subfolder (`siteDir`, default `"shared"`).
- A brain: the Claude Code harness (`lib/harness.ts`), run headless and scoped to that checkout.
- A publish target: FTP (Hostinger-style) or Vercel, with credentials stored encrypted, never in plain config.

**What it can do**

- Read the change request (which may be a long spec, brief, or ticket dump) and pull out only the edits that apply to this site.
- Produce a read-only plan before touching anything (`plan_changes`).
- Make the edit on a deterministic branch and commit it (`edit_site`).
- Deploy a preview build and get a URL back (`preview`).
- Open a pull request for review (`open_pr`), if the assignment's workflow wants a reviewable diff.
- Soft-discard a change it doesn't publish (`discard`) - the branch and commits stay around.

**What needs sign-off**

- Publishing to the live site (`publish`) always requires explicit human approval. This is enforced twice: the subagent's own instructions say to stop and report the preview, then wait; and the `publish` tool itself is gated with `needsApproval: always()`, so even if the subagent tried to call it speculatively, a human is asked. `publish` also refuses any Task that isn't in status `previewed`.

## Assignment config fields

An Assignment for this Role stores an `AssignmentConfig` (`lib/assignment-types.ts`):

| Field | Meaning |
| --- | --- |
| `repoUrl` | Where the repo lives (informational; `"local"` for a local-only checkout). |
| `workspacePath` | Local checkout of `repoUrl`. All git/harness/lftp work is scoped here. |
| `siteDir` | Subfolder of `workspacePath` holding the static site. Default `"shared"`. |
| `baseBranch` | Branch new work is cut from. Default `"main"`. |
| `publishTarget` | Where the site deploys - see the two shapes below. |
| `allowedTools` | Claude Code tools the harness may use. Narrows the server-side ceiling (`Read`, `Edit`, `MultiEdit`, `Write`, `Glob`, `Grep`); never widens it. |
| `model` | Model id passed through to Claude Code. Omit for the CLI default. |

`publishTarget.pass` (the FTP password) is never stored in `config`. It's passed separately as a `secrets` field when creating the Assignment and is AES-256-GCM encrypted into `assignments.secrets_enc`; only `resolveAssignmentConfig` ever decrypts it, and its result must never be logged or returned from a tool.

### Example: `hostinger-ftp`

```json
{
  "repoUrl": "local",
  "workspacePath": "/Users/you/gitrepos/yogaessence",
  "siteDir": "shared",
  "baseBranch": "main",
  "publishTarget": {
    "type": "hostinger-ftp",
    "host": "ftp.example.com",
    "port": 21,
    "user": "ftp-user",
    "remoteDir": ".",
    "baseUrl": "https://www.example.com/shared"
  },
  "allowedTools": ["Read", "Edit", "Write", "Glob", "Grep"]
}
```

(`pass` goes in `secrets: { publishPass: "..." }` at creation time, not in this object - see `lib/seed-assignment-yogaessence.ts`.)

Preview deploys mirror to `<remoteDir>/preview/<slug(branch)>` (with `--delete`, so stale preview files are cleaned up); publish mirrors to `<remoteDir>` itself without `--delete`, so the `preview/` folder is left untouched.

### Example: `vercel`

```json
{
  "repoUrl": "https://github.com/org/site-repo",
  "workspacePath": "/Users/you/gitrepos/site-repo",
  "siteDir": "shared",
  "baseBranch": "main",
  "publishTarget": {
    "type": "vercel",
    "projectId": "prj_xxx"
  },
  "allowedTools": ["Read", "Edit", "Write", "Glob", "Grep"]
}
```

Preview and publish for `vercel` targets are not implemented yet (`deployPreview`/`publishLive` throw); wire them up with `vercel deploy` / `vercel deploy --prod` when this target is needed.

## Operator commands

All commands assume `.env.local` is set up and Node 24 (`export PATH="$HOME/.local/share/fnm:$PATH"; eval "$(fnm env)"; fnm use 24`). See `scripts/README.md` for the authoritative, up-to-date version of this list.

1. **Seed the Role catalog** (once):
   ```
   npx tsx lib/seed-roles.ts
   ```
2. **Seed the Yoga Essence Assignment** (idempotent; reads `FTP_HOST`/`FTP_USER`/`FTP_PASS`/`FTP_PORT` from `../yogaessence/.env`, stores the password encrypted, never prints it):
   ```
   npx tsx lib/seed-assignment-yogaessence.ts
   ```
   Note the printed `assignmentId`.
3. **Run a Task in dry-run** (default; creates a Task, cuts `task/<id8>` in the workspace, prints the preview plan - no FTP, no LLM call):
   ```
   npx tsx scripts/run-task.ts --assignment <id> --request "smoke: no-op"
   ```
4. Add `--harness` to actually run Claude Code on the request and commit `siteDir` (calls an LLM, records usage).
5. Add `--deploy` to lftp-mirror the site to `<remoteDir>/preview/<slug>` and mark the Task `previewed`.
6. If `workspacePath` isn't a git repo yet, the script runs `git init -b main` plus an initial commit there (local only).
7. Inspect Task rows directly:
   ```
   docker exec rhea-pg psql -U rhea -d rhea -c "select task_id, status, branch, preview_url from tasks order by created_at desc limit 5"
   ```
