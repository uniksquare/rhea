import { test } from "node:test";
import assert from "node:assert/strict";
import { groupTasksByStatus, filterTasks, TASK_STATUS_ORDER } from "../lib/task-history.ts";

interface T {
  taskId: string;
  assignmentId: string;
  status: string;
  request: string;
}

function task(overrides: Partial<T>): T {
  return {
    taskId: "t-default",
    assignmentId: "a1",
    status: "requested",
    request: "Update the pricing page copy",
    ...overrides,
  };
}

test("groupTasksByStatus: every known status is present, even when empty", () => {
  const groups = groupTasksByStatus<T>([]);
  assert.deepEqual(
    groups.map((g) => g.status),
    [...TASK_STATUS_ORDER]
  );
  for (const g of groups) assert.deepEqual(g.tasks, []);
});

test("groupTasksByStatus: buckets tasks under their status", () => {
  const tasks = [
    task({ taskId: "t1", status: "working" }),
    task({ taskId: "t2", status: "discarded" }),
    task({ taskId: "t3", status: "working" }),
  ];
  const groups = groupTasksByStatus(tasks);
  const working = groups.find((g) => g.status === "working");
  const discarded = groups.find((g) => g.status === "discarded");
  assert.deepEqual(working?.tasks.map((t) => t.taskId), ["t1", "t3"]);
  assert.deepEqual(discarded?.tasks.map((t) => t.taskId), ["t2"]);
});

test("groupTasksByStatus: follows the fixed display order", () => {
  const tasks = [
    task({ taskId: "t1", status: "requested" }),
    task({ taskId: "t2", status: "failed" }),
    task({ taskId: "t3", status: "working" }),
  ];
  const groups = groupTasksByStatus(tasks).filter((g) => g.tasks.length > 0);
  assert.deepEqual(
    groups.map((g) => g.status),
    ["working", "failed", "requested"]
  );
});

test("groupTasksByStatus: appends unknown statuses after the fixed order, first-seen order", () => {
  const tasks = [
    task({ taskId: "t1", status: "publishing" }),
    task({ taskId: "t2", status: "weird-status" }),
    task({ taskId: "t3", status: "publishing" }),
  ];
  const groups = groupTasksByStatus(tasks);
  const tail = groups.slice(TASK_STATUS_ORDER.length).map((g) => g.status);
  assert.deepEqual(tail, ["publishing", "weird-status"]);
  assert.equal(groups.find((g) => g.status === "publishing")?.tasks.length, 2);
});

test("filterTasks: no filter returns everything", () => {
  const tasks = [task({ taskId: "t1" }), task({ taskId: "t2" })];
  assert.deepEqual(filterTasks(tasks, {}), tasks);
  assert.deepEqual(filterTasks(tasks), tasks);
});

test("filterTasks: filters by status", () => {
  const tasks = [
    task({ taskId: "t1", status: "discarded" }),
    task({ taskId: "t2", status: "working" }),
  ];
  const result = filterTasks(tasks, { status: "discarded" });
  assert.deepEqual(result.map((t) => t.taskId), ["t1"]);
});

test("filterTasks: filters by assignmentId", () => {
  const tasks = [
    task({ taskId: "t1", assignmentId: "a1" }),
    task({ taskId: "t2", assignmentId: "a2" }),
  ];
  const result = filterTasks(tasks, { assignmentId: "a2" });
  assert.deepEqual(result.map((t) => t.taskId), ["t2"]);
});

test("filterTasks: q matches request text case-insensitively", () => {
  const tasks = [
    task({ taskId: "t1", request: "Update the Pricing page copy" }),
    task({ taskId: "t2", request: "Fix the footer link" }),
  ];
  const result = filterTasks(tasks, { q: "pricing" });
  assert.deepEqual(result.map((t) => t.taskId), ["t1"]);
});

test("filterTasks: q is trimmed and blank q matches everything", () => {
  const tasks = [task({ taskId: "t1" }), task({ taskId: "t2" })];
  assert.deepEqual(filterTasks(tasks, { q: "   " }), tasks);
});

test("filterTasks: combines status, assignmentId, and q", () => {
  const tasks = [
    task({ taskId: "t1", status: "working", assignmentId: "a1", request: "Fix nav bug" }),
    task({ taskId: "t2", status: "working", assignmentId: "a2", request: "Fix nav bug" }),
    task({ taskId: "t3", status: "failed", assignmentId: "a1", request: "Fix nav bug" }),
    task({ taskId: "t4", status: "working", assignmentId: "a1", request: "Add footer" }),
  ];
  const result = filterTasks(tasks, { status: "working", assignmentId: "a1", q: "nav" });
  assert.deepEqual(result.map((t) => t.taskId), ["t1"]);
});

test("filterTasks: empty input returns empty output", () => {
  assert.deepEqual(filterTasks([], { status: "working" }), []);
});
