import { defineTool } from "eve/tools";
import { z } from "zod";
import { runHarness, harnessBilling } from "../../../../lib/harness.ts";
import {
  getAssignment,
  getTask,
  createTask,
  updateTask,
  recordUsage,
} from "../../../../lib/platform.ts";
import { errorText, planFromOutput, type Plan } from "../../../../lib/task-chat.ts";

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

    await updateTask(taskId, orgId, { status: "planning" });

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
        workspacePath: config.workspacePath,
        prompt,
        allowedTools: PLAN_TOOLS,
        readOnly: true,
        model: config.model,
        scope: { siteDir },
      });
    } catch (err) {
      await updateTask(taskId, orgId, { status: "failed", error: errorText(err) });
      throw err;
    }

    if (!harness.ok) {
      await updateTask(taskId, orgId, { status: "planning", error: errorText(harness.output) });
      throw new Error(`Planning failed: ${errorText(harness.output)}`);
    }

    const plan: Plan = planFromOutput(harness.output);

    await updateTask(taskId, orgId, { plan, status: "planning" });

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
