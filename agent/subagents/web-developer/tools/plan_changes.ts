import { defineTool } from "eve/tools";
import { z } from "zod";
import { runHarness, harnessBilling } from "../../../../lib/harness.ts";
import { resolveTaskWorkspace } from "../../../../lib/worktree.ts";
import {
  getAssignment,
  getTask,
  createTask,
  updateTask,
  recordUsage,
  type TaskStatus,
} from "../../../../lib/platform.ts";
import { branchForTask, claimFromAny, errorText, planFromOutput, type Plan } from "../../../../lib/task-chat.ts";

export type { Plan, PlanEdit } from "../../../../lib/task-chat.ts";

/** Read-only tool set for the planning run. Deliberately ignores config.allowedTools. */
const PLAN_TOOLS = ["Read", "Glob", "Grep"];

export default defineTool({
  description:
    "Create or resume a Task and produce a change plan without editing anything: runs the coding harness read-only over the assignment's siteDir and returns { summary, edits, questions } for the user to confirm before edit_site.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this change belongs to"),
    taskId: z.string().optional().describe("Existing Task id to resume; omit to start a new Task"),
    request: z.string().describe("The change request. May be a long document; the plan extracts the concrete edits for this site."),
  }),
  // Status flow: prev (requested | planning | previewed | failed) -> working
  // (atomic claim) -> planning when the task was requested/failed, otherwise
  // back to prev (a previewed task stays previewed: a plan changes no files).
  // On failure the task returns to prev (or "failed" from requested).
  async execute(input, ctx) {
    const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
    if (!orgId) {
      throw new Error("No organization found on the current session.");
    }

    const assignment = await getAssignment(input.assignmentId, orgId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found.`);
    }
    const config = assignment.config;
    const siteDir = config.siteDir ?? "shared";

    let taskId: string;
    if (input.taskId) {
      const existing = await getTask(input.taskId, orgId);
      if (!existing) {
        throw new Error(`Task ${input.taskId} not found.`);
      }
      if (existing.assignmentId !== input.assignmentId) {
        throw new Error(`Task ${input.taskId} does not belong to assignment ${input.assignmentId}.`);
      }
      taskId = existing.taskId;
    } else {
      const task = await createTask({
        orgId,
        assignmentId: input.assignmentId,
        request: input.request,
        sessionId: ctx.session.id,
      });
      taskId = task.taskId;
    }

    const claim = await claimFromAny(taskId, orgId, "working");
    if (!claim.ok) {
      throw new Error(`Task ${taskId} is busy (status "${claim.prev ?? "unknown"}").`);
    }
    const prev = claim.prev;
    const failedStatus: TaskStatus = prev === "requested" ? "failed" : prev;
    const successStatus: TaskStatus = prev === "requested" || prev === "failed" ? "planning" : prev;

    const fail = async (err: unknown): Promise<never> => {
      const text = errorText(err);
      try {
        await updateTask(taskId, orgId, { status: failedStatus, error: text });
      } catch {
        // ignore secondary failure
      }
      throw err instanceof Error ? err : new Error(text);
    };

    // Plan against the task's own worktree (the branch edit_site commits to),
    // never the shared checkout, so the plan sees this task's prior edits.
    const branch = branchForTask(taskId);
    let wt: typeof config;
    try {
      wt = await resolveTaskWorkspace(config, branch);
    } catch (err) {
      return fail(err);
    }

    const prompt = [
      `You are planning a scoped change to a website repo. This is a READ-ONLY planning pass.`,
      `Do NOT modify, create, or delete any files. Only inspect the site under the "${siteDir}" directory (use Read, Glob, Grep) so the plan references real files.`,
      `The change request below may be a long document (spec, brief, ticket dump). Extract only the concrete edits that apply to files inside "${siteDir}"; ignore anything out of scope for this site.`,
      `Respond ONLY with a single JSON object of this exact shape, with no prose before or after and no code fences:`,
      `{ "summary": string, "edits": [{ "file": string, "change": string }], "questions": string[] }`,
      `- "summary": one short paragraph describing the overall change.`,
      `- "edits": one entry per file to touch; "file" is the path relative to the repo root, "change" describes what to do in that file.`,
      `- "questions": anything ambiguous or missing that the user must answer before the edit can be made (empty array if none).`,
      `Change request:`,
      input.request,
    ].join("\n\n");

    let harness;
    try {
      harness = await runHarness({
        workspacePath: wt.workspacePath,
        prompt,
        allowedTools: PLAN_TOOLS,
        readOnly: true,
        model: config.model,
        scope: { siteDir },
      });
    } catch (err) {
      return fail(err);
    }

    if (!harness.ok) {
      return fail(new Error(`Planning failed: ${errorText(harness.output)}`));
    }

    const plan: Plan = planFromOutput(harness.output);

    await updateTask(taskId, orgId, { plan, status: successStatus });

    await recordUsage({
      orgId,
      assignmentId: input.assignmentId,
      taskId,
      roleKey: "web-developer",
      tool: "plan_changes",
      provider: harness.provider,
      model: harness.model,
      inputTokens: harness.usage.inputTokens,
      outputTokens: harness.usage.outputTokens,
      cacheReadTokens: harness.usage.cacheReadTokens,
      cacheWriteTokens: harness.usage.cacheWriteTokens,
      costUsd: harness.usage.costUsd,
      billing: harnessBilling(process.env),
    });

    return {
      taskId,
      plan,
      usage: harness.usage,
    };
  },
});
