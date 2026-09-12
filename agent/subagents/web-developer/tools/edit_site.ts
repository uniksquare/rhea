import { defineTool } from "eve/tools";
import { z } from "zod";
import { runHarness, harnessBilling } from "../../../../lib/harness.ts";
import { commitAll } from "../../../../lib/github.ts";
import { resolveTaskWorkspace, revertPaths } from "../../../../lib/worktree.ts";
import {
  getAssignment,
  getTask,
  createTask,
  updateTask,
  recordUsage,
  type TaskStatus,
} from "../../../../lib/platform.ts";
import { branchForTask, claimFromAny, errorText } from "../../../../lib/task-chat.ts";

export default defineTool({
  description:
    "Create or resume a Task and edit the assigned site repo: ensures a task branch, runs the coding harness scoped to the assignment's siteDir, and commits the result.",
  inputSchema: z.object({
    assignmentId: z.string().describe("The Assignment this change belongs to"),
    taskId: z.string().optional().describe("Existing Task id to resume; omit to start a new Task"),
    request: z.string().describe("The change request. May be a long document; extract the concrete edits for this site."),
  }),
  // Status flow: prev (requested | planning | previewed | failed) -> working
  // (atomic claim) -> planning on success; on failure siteDir is reverted and
  // the task returns to prev (or "failed" from requested, or "planning" when
  // the revert itself failed and the tree may be dirty).
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

    // Lock the task for the duration of this edit; a concurrent turn, preview
    // or publish on the same task makes the claim fail.
    const claim = await claimFromAny(taskId, orgId, "working");
    if (!claim.ok) {
      throw new Error(`Task ${taskId} is busy (status "${claim.prev ?? "unknown"}").`);
    }
    const prev = claim.prev;
    const failedStatus: TaskStatus = prev === "requested" ? "failed" : prev;

    const branch = branchForTask(taskId);
    let wt: typeof config | undefined;

    // Release the lock after a failure. Once the worktree exists the harness
    // may have touched files under siteDir, so revert them first; if that
    // revert fails the tree may be dirty and "planning" forces a re-preview.
    const fail = async (err: unknown): Promise<never> => {
      const text = errorText(err);
      let restoreTo: TaskStatus = failedStatus;
      let detail = text;
      if (wt) {
        try {
          await revertPaths({ workspacePath: wt.workspacePath, paths: [siteDir] });
        } catch (revertErr) {
          restoreTo = "planning";
          detail = `${text} (revert failed: ${errorText(revertErr)})`.slice(0, 500);
        }
      }
      try {
        await updateTask(taskId, orgId, { status: restoreTo, error: detail });
      } catch {
        // ignore secondary failure
      }
      throw err instanceof Error ? err : new Error(text);
    };

    // Each task works in its own git worktree so concurrent tasks never share
    // (or dirty) the assignment's main checkout.
    try {
      wt = await resolveTaskWorkspace(config, branch);
    } catch (err) {
      return fail(err);
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
        scope: { siteDir },
      });
    } catch (err) {
      return fail(err);
    }

    if (!harness.ok) {
      return fail(new Error(`Site edit failed: ${errorText(harness.output)}`));
    }

    let commit: Awaited<ReturnType<typeof commitAll>>;
    try {
      // Only stage the site directory so nothing outside siteDir can be committed.
      commit = await commitAll({
        workspacePath: wt.workspacePath,
        message: `rhea: ${input.request.slice(0, 72)}`,
        paths: [siteDir],
      });
    } catch (err) {
      return fail(err);
    }

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
