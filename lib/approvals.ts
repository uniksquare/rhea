/**
 * Pure grouping helpers for the Approvals inbox: one place to see every Task
 * waiting for sign-off (status "previewed"), grouped by its Assignment.
 *
 * No I/O here; the page (server component) does the auth + fetch and passes
 * plain, already-serialized rows in.
 */

export interface ApprovalTask {
  taskId: string;
  assignmentId: string;
  status: string;
  request: string;
  branch: string | null;
  previewUrl: string | null;
  createdAt: string | null;
}

export interface ApprovalAssignment {
  assignmentId: string;
  name: string;
  roleKey: string;
}

export interface ApprovalGroup {
  assignment: ApprovalAssignment;
  tasks: ApprovalTask[];
}

function taskTimeMs(task: ApprovalTask): number {
  if (!task.createdAt) return 0;
  const ms = new Date(task.createdAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Group tasks with status "previewed" by their assignment, newest task first
 * within each group. Tasks whose assignment is missing (deleted, wrong org)
 * are skipped rather than throwing. Groups themselves come out ordered by
 * their most recent pending task, since that is the order groups are first
 * encountered while walking the newest-first task list.
 */
export function groupPendingByAssignment(
  tasks: ApprovalTask[],
  assignments: ApprovalAssignment[]
): ApprovalGroup[] {
  const assignmentsById = new Map(assignments.map((a) => [a.assignmentId, a]));

  const pending = tasks.filter((t) => t.status === "previewed");
  const sorted = [...pending].sort((a, b) => taskTimeMs(b) - taskTimeMs(a));

  const groups = new Map<string, ApprovalGroup>();
  for (const task of sorted) {
    const assignment = assignmentsById.get(task.assignmentId);
    if (!assignment) continue;

    let group = groups.get(assignment.assignmentId);
    if (!group) {
      group = {
        assignment: {
          assignmentId: assignment.assignmentId,
          name: assignment.name,
          roleKey: assignment.roleKey,
        },
        tasks: [],
      };
      groups.set(assignment.assignmentId, group);
    }
    group.tasks.push(task);
  }

  return Array.from(groups.values());
}

/** Count of tasks currently waiting for sign-off (status "previewed"). */
export function countPending(tasks: ApprovalTask[]): number {
  return tasks.filter((t) => t.status === "previewed").length;
}
