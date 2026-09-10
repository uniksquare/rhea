# Adding a new Role

A checklist for teaching rhea a new kind of job. See `docs/naming-and-concepts.md` for the vocabulary and `docs/roles/web-developer.md` for a worked example.

1. **Create the subagent directory** - `agent/subagents/<role-key>/`, mirroring the shape of `agent/subagents/web-developer/` (or `agent/subagents/investigator/` for an ops-style Role). Add `agent.ts` (`defineAgent` with the Role's model/brain) and a `tools/` subfolder.

2. **Write `instructions.md`** - the subagent's own playbook: what it's scoped to, its objectives, its step-by-step workflow, and its rules (what it must never do). Follow the tone of `agent/subagents/web-developer/instructions.md`: explicit about scope (one Assignment, one workspace), explicit about where it must stop and wait for sign-off.

3. **Build its tools** - one file per action under `tools/`, each a `defineTool` (`eve/tools`) with a `zod` `inputSchema`. Every tool that reads or writes platform data (Assignment/Task/usage) must:
   - Pull `orgId` from `ctx.session.auth.current?.attributes?.orgId` and throw if missing.
   - Load the Assignment/Task through `lib/platform.ts` (never query the tables directly) so org scoping is enforced.
   - Gate any action that mutates a live system (publish, deploy, merge, notify) with `needsApproval: always()` from `eve/tools/approval` - never rely solely on the subagent's own instructions to stop before a mutation.

4. **Register the manifest in `lib/seed-roles.ts`** - add an entry to the `roles` array: `roleKey` (stable id, kebab-case), `name`, `description`, and `manifest` (`brain`, `workspace`, `playbooks`, `tools`, `signoff`). Re-run `npx tsx lib/seed-roles.ts` to upsert it.

5. **Wire permissions** - if the Role needs new RBAC actions, add them to `lib/rbac.ts`'s `Action` union and `ACTION_REQUIREMENTS`. Decide the minimum role (`VIEWER`/`OPERATOR`/`ADMIN`/`OWNER`) that may execute the Role and approve its mutations.

6. **Handle secrets** - if the Role's Assignment config needs credentials, follow `lib/platform.ts`'s `splitSecrets` pattern: never put credentials in `AssignmentConfig`/`config`; pass them through `createAssignment`'s `secrets` param so they're AES-256-GCM encrypted into `secrets_enc`, and only decrypt them inside a `resolveAssignmentConfig`-style function whose result is never logged, persisted, or returned from a tool.

7. **Add usage logging** - every LLM call the Role's tools make should call `recordUsage` (`lib/platform.ts`) with `orgId`, `assignmentId`, `taskId`, `roleKey`, `tool`, `provider`, `model`, and token counts, so cost is attributable per tenant/Role/Task in `UsageLedger`. If the Role's harness returns a `HarnessUsage`-shaped result (see `lib/assignment-types.ts`), this is usually a direct pass-through.

8. **Route to it from the top-level agent** - add a routing rule to `agent/instructions.md` so the top-level agent recognizes requests for this Role and delegates to the subagent (see the "Routing: identify the request, pick the Role" section). Keep the top-level agent's job to recognizing and delegating - it should not call the new Role's tools directly.

9. **Add an operator script (optional but recommended)** - a `scripts/run-<role-key>.ts`-style driver that exercises the Role's tools directly (create/resume, act, record usage) without Eve or the UI, for local smoke-testing. Follow `scripts/run-task.ts`'s dry-run-by-default pattern: nothing leaves the machine unless an explicit flag (`--deploy`, `--execute`, etc.) is passed.

10. **Document it** - add `docs/roles/<role-key>.md` (job description in plain language, config fields with an example, operator commands) following the shape of `docs/roles/web-developer.md`. Add the Role to the catalog table in `docs/naming-and-concepts.md`, and update `docs/architecture.md` if the Role introduces a new flow shape, a new data flow, or a new security boundary.
