import { defineTool } from "eve/tools";
import { z } from "zod";
import { runHarness, harnessBilling } from "../../../../lib/harness.ts";
import { commitAll } from "../../../../lib/github.ts";
import { resolveTaskWorkspace } from "../../../../lib/worktree.ts";
import {
  getAssignment,
  getTask,
  createTask,
  updateTask,
  recordUsage,
} from "../../../../lib/platform.ts";

// Deterministic branch name for a task, shared across this subagent's tools.
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

export default defineTool({
  description:
    "Create or resume a Task and edit the assigned site repo: ensures a task branch, runs the coding harness scoped to the assignment's siteDir, and commits the result.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this change belongs to"),
    taskId: z.string().optional().describe("Existing Task id to resume; omit to start a new Task"),
    request: z.string().describe("The change request. May be a long document; extract the concrete edits for this site."),
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

    // Mark the task as in progress before any git or harness work starts.
    await updateTask(taskId, orgId, { status: "planning" });

    const branch = branchForTask(taskId);
    // Each task works in its own git worktree so concurrent tasks never share
    // (or dirty) the assignment's main checkout.
    let wt: typeof config;
    try {
      wt = await resolveTaskWorkspace(config, branch);
    } catch (err) {
      await updateTask(taskId, orgId, { status: "failed", error: errorText(err) });
      throw err;
    }

    const prompt = [
      `You are making a scoped change to a website repo.`,
      `Only edit files inside the "${siteDir}" directory - never touch anything outside it.`,
      `Change request:`,
      input.request,
    ].join("\n\n");

    let harness;
    try {
      harness = await runHarness({
        workspacePath: wt.workspacePath,
        prompt,
        allowedTools: config.allowedTools,
        model: config.model,
      });
    } catch (err) {
      await updateTask(taskId, orgId, { status: "failed", error: errorText(err) });
      throw err;
    }

    if (!harness.ok) {
      await updateTask(taskId, orgId, { status: "planning", error: errorText(harness.output) });
      throw new Error(`Site edit failed: ${errorText(harness.output)}`);
    }

    // Only stage the site directory so nothing outside siteDir can be committed.
    const commit = await commitAll({
      workspacePath: wt.workspacePath,
      message: `rhea: ${input.request.slice(0, 72)}`,
      paths: [siteDir],
    });

    await updateTask(taskId, orgId, { branch, status: "planning" });

    await recordUsage({
      orgId,
      assignmentId: input.assignmentId,
      taskId,
      roleKey: "web-developer",
      tool: "edit_site",
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
      branch,
      changed: commit.changed,
      sha: commit.sha,
      summary: harness.output,
      usage: harness.usage,
    };
  },
});
