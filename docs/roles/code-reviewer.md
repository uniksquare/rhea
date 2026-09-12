# Role: Code Reviewer

## Job description, in plain language

rhea in the Code Reviewer Role reviews the open pull requests on one assigned repo against a rules list the tenant configured, and only posts review comments after a human signs off. It is always scoped to a single Assignment (one repo, one `assignmentId`) and never touches any other repo. Unlike the Web Developer Role, it is designed to run unattended on a schedule as well as on demand.

**What it needs**

- A repo with a GitHub remote (`repoUrl` pointing at `https://github.com/<owner>/<repo>` or `git@github.com:<owner>/<repo>`) and `gh` authenticated in the environment that runs it (no separate token stored per assignment; it uses whatever `gh auth` session is available to the process).
- A brain: the Claude Code harness (`lib/harness.ts`), run headless and read-only over the PR diffs. No file edits are made in the repo itself.
- A rules list (`review.rules`), plain-language review rules the tenant configured for this assignment (for example, "no `console.log` in committed code", "new exported functions need tests").

**What it does**

- Fetches the repo's open pull requests (`list_open_prs`, capped at `review.maxPrs`).
- Reviews each PR's diff against `review.rules` and builds a structured summary: verdict plus findings, each naming the rule, the file/line, and a short explanation (`review_pr`, planned).
- Posts the findings as review comments on the PR (`post_review`, planned), but only after sign-off.

**What needs sign-off**

- Fetching PRs and building the review summary is read-only and needs no approval; it is safe to run automatically, including on a schedule.
- Posting review comments (`post_review`) always requires explicit human approval, the same two-layer pattern as the Web Developer Role's `publish`: the subagent's instructions say to stop and report the summary first, and the `post_review` tool itself is gated with `needsApproval: always()` once it exists. A scheduled run's `review.postComments: true` means "propose posting once approved," never "post without asking."
- If `review.postComments` is `false` for an assignment, the subagent never proposes posting at all; it only ever delivers read-only summaries.

## Assignment config fields

An Assignment for this Role stores an `AssignmentConfig` (`lib/assignment-types.ts`) plus free-form JSON fields specific to this Role, the same pattern other Roles use to layer on top of the shared shape:

| Field | Meaning |
| --- | --- |
| `repoUrl` | The repo's GitHub remote, e.g. `https://github.com/org/repo`. Required; must be a GitHub URL. |
| `baseBranch` | Branch PRs target. Default `"main"`. Informational for this Role; it does not cut branches itself. |
| `review.schedule` | Cron string for scheduled runs, e.g. `"0 14 * * 1-5"` (2pm UTC, weekdays). Absent means on-demand only. |
| `review.maxPrs` | Max number of open PRs to fetch per run. Default `10`. |
| `review.rules` | Plain-language review rules to check each diff against. |
| `review.postComments` | Whether a run should propose posting comments once approved. `false` means summaries only, never a posting proposal. Default `false`. |

### Example

```json
{
  "repoUrl": "https://github.com/org/site-repo",
  "baseBranch": "main",
  "review": {
    "schedule": "0 14 * * 1-5",
    "maxPrs": 10,
    "rules": [
      "no console.log in committed code",
      "new exported functions need tests",
      "no secrets or API keys in diffs"
    ],
    "postComments": true
  }
}
```

Nothing in this config is a credential; `gh` auth is provided by the environment, not stored per assignment. If a future variant needs a repo-specific token (e.g. a fine-grained PAT for a repo the ambient `gh` session can't see), it should follow `lib/platform.ts`'s `splitSecrets` pattern: never in `config`, only through `createAssignment`'s `secrets` param.

## Task lifecycle for this Role

Each scheduled or on-demand review is one Task, mapped onto the same `requested -> working -> previewed -> published / discarded` shape every Role uses:

| Status | Meaning for Code Reviewer |
| --- | --- |
| `requested` | A review run was asked for (by a person, or by the schedule firing) but hasn't started. |
| `working` | `list_open_prs` and the diff review are in progress; the harness is reading PRs read-only. |
| `previewed` | The review summary (verdicts + findings per PR) is ready and stored on the Task; nothing has been posted to GitHub. |
| `published` | `post_review` posted the findings as comments on the reviewed PRs, after sign-off. |
| `discarded` | The summary was reviewed and dropped without posting (soft discard, same as Web Developer's `discard` - the Task record and its summary are kept). |
| `failed` | `list_open_prs` or the review step errored (bad `repoUrl`, `gh` not authenticated, etc.); the error is recorded on the Task. |

One Task per review run, so a daily schedule produces a new Task (and a fresh, auditable summary) each time it fires, rather than reusing one Task across runs.

## Scheduling design (proposed, out of scope for this change)

No scheduler exists in rhea yet. The proposed shape, to be built when this Role goes live:

- A cron trigger outside the app process, either Vercel Cron (a `crons` entry in `vercel.json`) or a Fly.io scheduled machine, configured per environment.
- The cron target is a single endpoint, `POST /api/roles/code-reviewer/run`, authenticated with a server-only secret (a cron secret header, not a user session) and taking `{ assignmentId }` in its body.
- The endpoint creates a Task (`requested`), runs the same `list_open_prs` -> review -> `previewed` flow the on-demand chat path uses, and stops there. It never calls `post_review` itself; posting still needs a human to open the Task and approve it, the same sign-off gate as an interactive run.
- Each assignment's `review.schedule` (a cron string) is read by whatever triggers the cron job, either a static `vercel.json` entry per assignment or, once more than a couple of assignments use this Role, a single periodic tick that fans out to every assignment whose `review.schedule` matches the current time.
- Building this (the endpoint, the cron wiring, and the fan-out) is explicitly not part of this change; only the manifest, the subagent skeleton, and the read-only `list_open_prs` tool are.

## Operator commands

All commands assume `.env.local` is set up, Node 24 (`export PATH="$HOME/.local/share/fnm:$PATH"; eval "$(fnm env)"; fnm use 24`), and `gh` authenticated in the shell that runs them.

1. **Seed the Role catalog** (once, idempotent):
   ```
   npx tsx lib/seed-roles.ts
   ```
2. Once an Assignment exists for this Role (seeding a Code Reviewer assignment is not part of this change; follow `lib/seed-assignment-yogaessence.ts` as the pattern when one is added), list its open PRs directly by calling the `list_open_prs` tool through an operator script, mirroring `scripts/run-task.ts`'s dry-run-by-default shape: nothing is posted to GitHub, since `post_review` doesn't exist yet and `list_open_prs` never writes.
3. Inspect Task rows directly:
   ```
   docker exec rhea-pg psql -U rhea -d rhea -c "select task_id, status, branch, preview_url from tasks order by created_at desc limit 5"
   ```
