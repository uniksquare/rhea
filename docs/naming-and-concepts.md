# rhea: naming and concepts

The shared vocabulary for rhea. The product speaks in human terms; the code keeps its engineering terms under the hood. Both columns mean the same thing.

## The idea in one line

rhea is an **AI teammate**. You put it in a **Role**, give it an **Assignment**, and it completes **Tasks** from request to done.

> Example: rhea in the **Web Developer** role, **assigned** to the Yoga Essence site, handles the **task** "update the CTA" from request to live.

## Vocabulary

| Human term (product) | Engineering term (code) | Meaning |
| --- | --- | --- |
| **rhea** | platform / control plane | The AI teammate that does the work |
| **Role** | capability | A kind of job rhea can do (Web Developer, Code Reviewer, Monitor) |
| **Assignment** | deployment / instance | rhea doing one Role for one client/repo |
| **Task** | run | One request rhea completes end to end |
| **Job description** | manifest | What a Role needs: brain, workspace, playbooks, tools, sign-off, settings, keys |
| **Team member / client** | tenant | Who an Assignment belongs to, with their roles/permissions |

Onboard a client = give rhea a new **Assignment**. Add a new kind of work = teach rhea a new **Role**.

## Anatomy of a Role (its job description)

| Part | Plain meaning | Under the hood |
| --- | --- | --- |
| **Brain** | Which AI does the thinking | Model + harness (Claude headless, or Gemini via Vertex) |
| **Workspace** | The files it works in | Git repo checkout |
| **Playbooks** | Its know-how and procedures | Skills (instruction packs) |
| **Tools** | What it is allowed to do | Action modules: preview, publish, open PR, deploy, scrape |
| **Sign-off** | Actions that need a human OK first | Approvals / guards |
| **Settings & keys** | Specifics + credentials per assignment | Config + encrypted secrets |
| **Who it works for** | Team members / clients assigned | Tenants + RBAC |

## Role catalog

| Role | Workspace | Brain | Key tools |
| --- | --- | --- | --- |
| **On-call Engineer** (built) | ops connectors | Gemini | investigate, remediate, notify |
| **Web Developer** (first new) | static/HTML repo | Claude harness | edit, preview, FTP publish / Vercel deploy |
| **App Developer** (later) | Next + Neon repo | Claude harness | scaffold, migrate, preview, deploy |
| **Code Reviewer** (later) | any repo | Claude / Gemini | fetch PRs, review, comment (can be scheduled) |
| **Monitor** (later) | any target | either | poll, diff, alert (scheduled) |
| **Researcher** (later) | any target | either | fetch, extract, store |

Same job-description shape, different fills. Scheduled roles just add a schedule to their settings.

## Principles

- **rhea is one teammate in many roles**, not one tool per client. yogaessence is an Assignment, not a bespoke app.
- **Both brains are welcome.** Gemini (Vertex) tends to orchestrate and converse; the Claude harness does heavy code editing. A Role picks per task.
- **Risky tools need sign-off.** Publishing to prod, merging a PR: gated by approval, set per Assignment.
- **Every Task is auditable**: its own thread, branch, preview, and recorded usage (tokens + cost per tenant, role, and task).
