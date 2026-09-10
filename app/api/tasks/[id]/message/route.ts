import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission, type Role } from "@/lib/rbac";
import {
  getTask,
  getAssignment,
  updateTask,
  claimTaskStatus,
  addTaskMessage,
  recordUsage,
  type TaskMessageMode,
  type TaskStatus,
} from "@/lib/platform";
import { runHarness, harnessBilling, READ_ONLY_TOOLS } from "@/lib/harness";
import { resolveTaskWorkspace } from "@/lib/worktree";
import { commitAll } from "@/lib/github";
import {
  TASK_MESSAGE_MAX,
  TASK_ROLE_KEY,
  branchForTask,
  buildTaskPrompt,
  errorText,
  isChatClaimable,
  isChatLocked,
  loadJobDescription,
  planFromOutput,
} from "@/lib/task-chat";
import type { HarnessResult } from "@/lib/assignment-types";

// The harness can take a minute or more; give the route room to finish.
export const maxDuration = 300;

type Body = { message: string; mode: TaskMessageMode };

function parseBody(raw: unknown): Body | string {
  if (!raw || typeof raw !== "object") return "Body must be a JSON object";
  const { message, mode } = raw as { message?: unknown; mode?: unknown };
  if (typeof message !== "string" || message.trim().length === 0) {
    return "message is required";
  }
  if (message.length > TASK_MESSAGE_MAX) {
    return `message must be at most ${TASK_MESSAGE_MAX} characters`;
  }
  if (mode !== undefined && mode !== "plan" && mode !== "edit") {
    return 'mode must be "plan" or "edit"';
  }
  return { message, mode: mode ?? "edit" };
}

// POST: one turn of the client-facing Task chat. "plan" runs the harness
// read-only and stores the plan; "edit" lets it edit inside siteDir in the
// task's worktree and commits. Never returns secrets.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requirePermission(session.user.role as Role, "tasks:request");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const orgId = session.user.orgId;

  const body = parseBody(await request.json().catch(() => null));
  if (typeof body === "string") {
    return NextResponse.json({ error: body }, { status: 400 });
  }
  const { message, mode } = body;

  const task = await getTask(id, orgId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status === "working") {
    return NextResponse.json({ error: "Task is busy" }, { status: 409 });
  }
  if (isChatLocked(task.status) || !isChatClaimable(task.status)) {
    return NextResponse.json(
      { error: `Task is ${task.status}; it no longer accepts messages` },
      { status: 409 }
    );
  }
  const assignment = await getAssignment(task.assignmentId, orgId);
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const config = assignment.config;
  const siteDir = config.siteDir ?? "shared";
  const branch = task.branch ?? branchForTask(task.taskId);
  const firstTurn = !task.sessionId;

  // Lock the task for the duration of this turn. The atomic claim is what
  // stops two concurrent turns from resuming the same session and racing on
  // the worktree; the loser gets 409.
  const prev: TaskStatus = task.status;
  const claimed = await claimTaskStatus(id, orgId, prev, "working");
  if (!claimed) {
    return NextResponse.json({ error: "Task is busy" }, { status: 409 });
  }

  // Status after a failed turn: back to where it was, except a task that had
  // never progressed past "requested" becomes "failed".
  const failedStatus: TaskStatus = prev === "requested" ? "failed" : prev;

  await addTaskMessage({ orgId, taskId: id, role: "user", content: message, mode });

  const fail = async (err: unknown, status = 502) => {
    const text = errorText(err);
    try {
      await addTaskMessage({ orgId, taskId: id, role: "assistant", content: `Error: ${text}`, mode });
    } catch {
      // ignore secondary failure
    }
    try {
      await updateTask(id, orgId, { status: failedStatus, error: text });
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json({ error: text }, { status });
  };

  let wt: typeof config;
  let jobDescription: string;
  try {
    wt = await resolveTaskWorkspace(config, branch);
    jobDescription = await loadJobDescription();
  } catch (err) {
    return fail(err);
  }

  const prompt = buildTaskPrompt({
    firstTurn,
    jobDescription,
    siteDir,
    request: task.request,
    message,
    mode,
  });

  let harness: HarnessResult;
  try {
    harness =
      mode === "plan"
        ? await runHarness({
            workspacePath: wt.workspacePath,
            prompt,
            allowedTools: [...READ_ONLY_TOOLS],
            readOnly: true,
            model: config.model,
            resumeSessionId: task.sessionId ?? undefined,
            scope: { siteDir },
          })
        : await runHarness({
            workspacePath: wt.workspacePath,
            prompt,
            allowedTools: config.allowedTools,
            model: config.model,
            resumeSessionId: task.sessionId ?? undefined,
            scope: { siteDir },
          });
  } catch (err) {
    return fail(err);
  }

  const billing = harnessBilling(process.env);
  const usageRow = {
    orgId,
    assignmentId: task.assignmentId,
    taskId: id,
    roleKey: TASK_ROLE_KEY,
    tool: mode === "plan" ? "plan_changes" : "edit_site",
    provider: harness.provider,
    model: harness.model,
    inputTokens: harness.usage.inputTokens,
    outputTokens: harness.usage.outputTokens,
    cacheReadTokens: harness.usage.cacheReadTokens,
    cacheWriteTokens: harness.usage.cacheWriteTokens,
    costUsd: harness.usage.costUsd,
    billing,
  };

  if (!harness.ok) {
    try {
      await recordUsage(usageRow);
    } catch {
      // usage is best-effort on a failed turn
    }
    return fail(new Error(harness.output));
  }

  try {
    let plan: unknown;
    let changed: boolean | undefined;
    let sha: string | undefined;
    if (mode === "plan") {
      plan = planFromOutput(harness.output);
      // A plan turn changes no files, so the task returns to the status it
      // had (a previewed task stays previewed); a fresh or failed task moves
      // to "planning" now that it has a plan.
      const status: TaskStatus = prev === "requested" || prev === "failed" ? "planning" : prev;
      await updateTask(id, orgId, { plan, sessionId: harness.sessionId, status });
    } else {
      // Only stage the site directory so nothing outside siteDir can be committed.
      const commit = await commitAll({
        workspacePath: wt.workspacePath,
        message: `rhea: ${message.slice(0, 72)}`,
        paths: [siteDir],
      });
      changed = commit.changed;
      sha = commit.sha;
      await updateTask(id, orgId, { sessionId: harness.sessionId, branch, status: "planning" });
    }

    const reply = await addTaskMessage({
      orgId,
      taskId: id,
      role: "assistant",
      content: harness.output.slice(0, TASK_MESSAGE_MAX),
      mode,
      usage: { ...harness.usage, billing, model: harness.model, provider: harness.provider },
    });
    await recordUsage(usageRow);

    return NextResponse.json({
      ok: true,
      mode,
      branch,
      sessionId: harness.sessionId,
      plan,
      changed,
      sha,
      message: {
        messageId: reply.messageId,
        role: reply.role,
        content: reply.content,
        mode: reply.mode,
        createdAt: reply.createdAt,
      },
      usage: harness.usage,
    });
  } catch (err) {
    return fail(err);
  }
}
