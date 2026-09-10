import { test } from "node:test";
import assert from "node:assert/strict";
import { groupPendingByAssignment, countPending, type ApprovalTask, type ApprovalAssignment } from "../lib/approvals.ts";

const assignments: ApprovalAssignment[] = [
  { assignmentId: "a1", name: "Marketing site", roleKey: "web-developer" },
  { assignmentId: "a2", name: "On-call bot", roleKey: "on-call-engineer" },
];

function task(overrides: Partial<ApprovalTask>): ApprovalTask {
  return {
    taskId: "t-default",
    assignmentId: "a1",
    status: "previewed",
    request: "Update the pricing page copy",
    branch: "rhea/t-default",
    previewUrl: "https://preview.example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("groupPendingByAssignment: only includes tasks with status previewed", () => {
  const tasks = [
    task({ taskId: "t1", status: "previewed" }),
    task({ taskId: "t2", status: "published" }),
    task({ taskId: "t3", status: "discarded" }),
    task({ taskId: "t4", status: "requested" }),
  ];
  const groups = groupPendingByAssignment(tasks, assignments);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].tasks.length, 1);
  assert.equal(groups[0].tasks[0].taskId, "t1");
});

test("groupPendingByAssignment: groups by assignment and orders tasks within a group newest first", () => {
  const tasks = [
    task({ taskId: "t1", assignmentId: "a1", createdAt: "2026-01-01T00:00:00.000Z" }),
    task({ taskId: "t2", assignmentId: "a1", createdAt: "2026-01-03T00:00:00.000Z" }),
    task({ taskId: "t3", assignmentId: "a1", createdAt: "2026-01-02T00:00:00.000Z" }),
  ];
  const groups = groupPendingByAssignment(tasks, assignments);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].tasks.map((t) => t.taskId),
    ["t2", "t3", "t1"]
  );
});

test("groupPendingByAssignment: orders groups by their most recent pending task", () => {
  const tasks = [
    task({ taskId: "t1", assignmentId: "a1", createdAt: "2026-01-01T00:00:00.000Z" }),
    task({ taskId: "t2", assignmentId: "a2", createdAt: "2026-01-05T00:00:00.000Z" }),
  ];
  const groups = groupPendingByAssignment(tasks, assignments);
  assert.deepEqual(
    groups.map((g) => g.assignment.assignmentId),
    ["a2", "a1"]
  );
});

test("groupPendingByAssignment: skips tasks whose assignment is missing", () => {
  const tasks = [task({ taskId: "t1", assignmentId: "does-not-exist" })];
  const groups = groupPendingByAssignment(tasks, assignments);
  assert.deepEqual(groups, []);
});

test("groupPendingByAssignment: treats missing/invalid createdAt as oldest", () => {
  const tasks = [
    task({ taskId: "t1", assignmentId: "a1", createdAt: null }),
    task({ taskId: "t2", assignmentId: "a1", createdAt: "2026-01-01T00:00:00.000Z" }),
    task({ taskId: "t3", assignmentId: "a1", createdAt: "not-a-date" }),
  ];
  const groups = groupPendingByAssignment(tasks, assignments);
  assert.equal(groups[0].tasks[0].taskId, "t2");
});

test("groupPendingByAssignment: returns an empty array when there are no pending tasks", () => {
  assert.deepEqual(groupPendingByAssignment([], assignments), []);
});

test("countPending: counts only previewed tasks", () => {
  const tasks = [
    task({ taskId: "t1", status: "previewed" }),
    task({ taskId: "t2", status: "previewed" }),
    task({ taskId: "t3", status: "published" }),
    task({ taskId: "t4", status: "discarded" }),
  ];
  assert.equal(countPending(tasks), 2);
});

test("countPending: zero for an empty list", () => {
  assert.equal(countPending([]), 0);
});
