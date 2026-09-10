/**
 * Pure helpers for the Tasks history page: group tasks by status in a fixed
 * display order, and filter a task list by status, assignment, and search
 * text. No I/O here; the page does the auth + fetch and passes plain,
 * already-serialized rows in.
 */

/**
 * Fixed status display order for the Tasks history page. A task whose status
 * is not in this list (e.g. "publishing") is appended after these, in the
 * order it is first encountered, so no task is ever silently dropped.
 */
export const TASK_STATUS_ORDER = [
  "working",
  "planning",
  "previewed",
  "published",
  "discarded",
  "failed",
  "requested",
] as const;

export interface StatusGroup<T> {
  status: string;
  tasks: T[];
}

/**
 * Group tasks by status, ordered per TASK_STATUS_ORDER. Every status in that
 * order is present in the result (possibly with an empty list); any status
 * outside the order is appended afterward, in first-seen order.
 */
export function groupTasksByStatus<T extends { status: string }>(tasks: T[]): StatusGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const status of TASK_STATUS_ORDER) buckets.set(status, []);

  const extraOrder: string[] = [];
  for (const task of tasks) {
    if (!buckets.has(task.status)) {
      buckets.set(task.status, []);
      extraOrder.push(task.status);
    }
    buckets.get(task.status)!.push(task);
  }

  return [...TASK_STATUS_ORDER, ...extraOrder].map((status) => ({
    status,
    tasks: buckets.get(status) ?? [],
  }));
}

export interface TaskFilter {
  status?: string;
  assignmentId?: string;
  /** Case-insensitive substring match against the task's request text. */
  q?: string;
}

/**
 * Filter tasks by status, assignment, and/or a search string matched
 * case-insensitively against the request text. An omitted filter field
 * passes everything through for that dimension.
 */
export function filterTasks<T extends { status: string; assignmentId: string; request: string }>(
  tasks: T[],
  filter: TaskFilter = {}
): T[] {
  const { status, assignmentId, q } = filter;
  const needle = q?.trim().toLowerCase();
  return tasks.filter((task) => {
    if (status && task.status !== status) return false;
    if (assignmentId && task.assignmentId !== assignmentId) return false;
    if (needle && !task.request.toLowerCase().includes(needle)) return false;
    return true;
  });
}
