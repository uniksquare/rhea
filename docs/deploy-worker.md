# Deploying the worker image to Fly.io

This runs the rhea-v2 Web Developer harness and the Eve runtime off Fly.io
instead of the operator's laptop. The app is a single Next.js process (Eve
is mounted in-process via `withEve` in `next.config.ts`), so one container,
one port, one Fly app.

Files: `Dockerfile.worker`, `fly.worker.toml`, `.dockerignore`.

## 1. First-time setup

From the repo root, with the Fly CLI already authenticated
(`fly auth login`):

```bash
fly launch --no-deploy -c fly.worker.toml
```

This registers the `rhea-worker` app (rename it first in `fly.worker.toml`
if that name is taken) without deploying yet.

Create the persistent volume for task workspaces
(`RHEA_WORKSPACE_ROOTS=/data/workspaces`):

```bash
fly volumes create rhea_data --size 10 -r sin
```

Adjust `--size` (GB) to how many concurrent task workspaces you expect to
keep checked out.

## 2. Secrets

Non-secret defaults (`NODE_ENV`, `RHEA_HARNESS_ENGINE`,
`RHEA_WORKSPACE_ROOTS`) are already in `fly.worker.toml`'s `[env]` block.
Everything else is a secret, set once per app:

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  ENCRYPTION_KEY="..." \
  AUTH_SECRET="..." \
  ANTHROPIC_API_KEY="sk-ant-..." \
  GEMINI_API_KEY="..."
```

Add any others the deployed Assignments need (for example
`AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
if OAuth login is exposed from this app instance).

### Auth mode: do not use Claude Max OAuth in production

`RHEA_HARNESS_ENGINE=cli` (the default in `fly.worker.toml`) runs the
`claude` CLI directly, per `lib/harness.ts`. That CLI supports two ways to
authenticate:

- **Claude Max / Pro subscription OAuth** (interactive `claude login`,
  browser-based). This does not work headless on a server: there is no
  browser and no way to complete the OAuth flow non-interactively, and the
  login is tied to the operator's own account. `RHEA_HARNESS_AUTH` must
  **not** be set to `"subscription"` in production (see
  `lib/harness.ts`'s `usesSubscriptionAuth`); leave it unset or set it to
  anything else.
- **API key auth**, which does work headless. Set `ANTHROPIC_API_KEY` as a
  secret (above) and the harness's child-process env allowlist
  (`CHILD_ENV_ALLOWLIST` in `lib/harness.ts`) forwards it to the `claude`
  CLI automatically.

Alternatively, use Claude on Vertex: set `CLAUDE_CODE_USE_VERTEX=1` plus
`ANTHROPIC_VERTEX_PROJECT_ID`, `CLOUD_ML_REGION`, and
`GOOGLE_APPLICATION_CREDENTIALS` (all already on the allowlist) instead of
`ANTHROPIC_API_KEY`.

## 3. Deploy

```bash
fly deploy -c fly.worker.toml
```

This builds `Dockerfile.worker` remotely on Fly's builders and rolls the
`rhea-worker` app. Re-run the same command for subsequent deploys.

## Secret list (reference)

| Secret | Required | Used by |
| --- | --- | --- |
| `DATABASE_URL` | yes | Prisma / `lib/db.ts` |
| `ENCRYPTION_KEY` | yes | `lib/crypto.ts` (Assignment `secretsEnc`) |
| `AUTH_SECRET` | yes | NextAuth session signing |
| `ANTHROPIC_API_KEY` | yes, unless using Vertex | `agent/model.ts`, `lib/harness.ts` |
| `GEMINI_API_KEY` | optional | `agent/model.ts` fallback provider |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | if GitHub login enabled | NextAuth |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | if Google login enabled | NextAuth |
| `CLAUDE_CODE_USE_VERTEX` + `ANTHROPIC_VERTEX_PROJECT_ID` + `CLOUD_ML_REGION` + `GOOGLE_APPLICATION_CREDENTIALS` | alternative to `ANTHROPIC_API_KEY` | `lib/harness.ts` (Vertex-backed Claude Code) |

## Notes

- The image runs `npm run start` (`next start`), not `eve start`: eve is
  mounted inside Next via `withEve`, so Next serves both the cockpit UI/API
  routes and eve's session/stream/channel routes on the same port (3000).
  See `node_modules/eve/docs/guides/deployment.md`, "How eve sits behind a
  host framework".
- `git`, `gh`, and `lftp` are installed as system packages in the runtime
  image for `lib/github.ts` and `lib/previewer.ts`/`lib/publisher.ts`. The
  `claude` CLI is installed globally for `lib/harness.ts`. The `vercel` CLI
  ships as a devDependency in `node_modules/.bin/vercel` and is kept in the
  runtime image (devDependencies are not pruned) for `lib/vercel.ts`.
- `RHEA_WORKSPACE_ROOTS=/data/workspaces` points task workspaces at the Fly
  volume so they survive machine restarts; without a mounted volume at
  `/data`, workspace state is lost whenever the machine stops (this app's
  `[http_service]` has `auto_stop_machines = true`).

## Volume ownership and long runs

- The image starts as root only to `chown` the mounted `/data` volume (root-owned on first boot) and then drops to the `rhea` user via `gosu` (`docker-entrypoint.sh`). No manual permission step is needed.
- Harness runs happen inside an open Eve stream connection, so `auto_stop_machines` will not stop a machine mid-run. Fly's edge can still drop a connection it considers idle; if long edits time out, raise the Fly HTTP idle timeout or move heavy edits to a background job.
