import { defineTool } from "eve/tools";
import { z } from "zod";
import { runHarness } from "../../../../lib/harness.ts";
import { ensureBranch, commitAll } from "../../../../lib/github.ts";
import { getAssignment, createTask, updateTask, recordUsage } from "../../../../lib/platform.ts";
import type { AssignmentConfig } from "../../../../lib/assignment-types.ts";

// Deterministic branch name for a task, shared across this subagent's tools.
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
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

    const assignment = await getAssignment(input.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found.`);
    }
    const config = assignment.config as AssignmentConfig;
    const siteDir = config.siteDir ?? "shared";

    let taskId: string;
    if (input.taskId) {
      taskId = input.taskId;
    } else {
      const task = await createTask({
        orgId,
        assignmentId: input.assignmentId,
        request: input.request,
        sessionId: ctx.session.id,
      });
      taskId = task.taskId;
      await updateTask(taskId, { status: "planning" });
    }

    const branch = branchForTask(taskId);
    await ensureBranch({
      workspacePath: config.workspacePath,
      branch,
      base: config.baseBranch,
    });

    const prompt = [
      `You are making a scoped change to a website repo.`,
      `Only edit files inside the "${siteDir}" directory - never touch anything outside it.`,
      `Change request:`,
      input.request,
    ].join("\n\n");

    const harness = await runHarness({
      workspacePath: config.workspacePath,
      prompt,
      allowedTools: config.allowedTools,
      model: config.model,
    });

    if (!harness.ok) {
      await updateTask(taskId, { status: "planning", error: harness.output });
      throw new Error(`Site edit failed: ${harness.output}`);
    }

    const commit = await commitAll({
      workspacePath: config.workspacePath,
      message: `rhea: ${input.request.slice(0, 72)}`,
    });

    await updateTask(taskId, { branch, status: "planning" });

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
