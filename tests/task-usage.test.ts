import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaskUsageRow } from "../lib/task-usage.ts";
import { summarizeTaskUsage } from "../lib/task-usage.ts";

function row(overrides: Partial<TaskUsageRow> = {}): TaskUsageRow {
  return {
    createdAt: new Date("2026-09-10T12:00:00Z"),
    tool: "plan_changes",
    provider: "anthropic",
    model: "claude-sonnet-5",
    billing: "api",
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
    costUsd: 1.5,
    ...overrides,
  };
}

test("summarizeTaskUsage returns zeroed totals for an empty ledger", () => {
  const summary = summarizeTaskUsage([]);
  assert.deepEqual(summary, {
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    billedCostUsd: 0,
    subscriptionTurns: 0,
    byTool: {},
  });
});

test("summarizeTaskUsage sums tokens and turns across all rows", () => {
  const rows: TaskUsageRow[] = [
    row({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 5 }),
    row({ inputTokens: 200, outputTokens: 80, cacheReadTokens: 20, cacheWriteTokens: 0 }),
  ];
  const summary = summarizeTaskUsage(rows);

  assert.equal(summary.turns, 2);
  assert.equal(summary.inputTokens, 300);
  assert.equal(summary.outputTokens, 130);
  assert.equal(summary.cacheReadTokens, 30);
  assert.equal(summary.cacheWriteTokens, 5);
});

test("summarizeTaskUsage bills only api rows and counts subscription turns separately", () => {
  const rows: TaskUsageRow[] = [
    row({ billing: "api", costUsd: 1.5 }),
    row({ billing: "subscription", costUsd: 42 }),
  ];
  const summary = summarizeTaskUsage(rows);

  assert.equal(summary.billedCostUsd, 1.5, "subscription cost is nominal and never billed");
  assert.equal(summary.subscriptionTurns, 1);
  assert.equal(summary.turns, 2);
});

test("summarizeTaskUsage groups byTool with per-tool turns and token totals", () => {
  const rows: TaskUsageRow[] = [
    row({ tool: "plan_changes", inputTokens: 100, outputTokens: 50 }),
    row({ tool: "plan_changes", inputTokens: 20, outputTokens: 10 }),
    row({ tool: "edit_file", inputTokens: 5, outputTokens: 5 }),
  ];
  const { byTool } = summarizeTaskUsage(rows);

  assert.equal(Object.keys(byTool).length, 2);
  assert.deepEqual(byTool.plan_changes, { turns: 2, inputTokens: 120, outputTokens: 60 });
  assert.deepEqual(byTool.edit_file, { turns: 1, inputTokens: 5, outputTokens: 5 });
});

test("summarizeTaskUsage never mutates the input rows array", () => {
  const rows: TaskUsageRow[] = [row()];
  const snapshot = JSON.stringify(rows);
  summarizeTaskUsage(rows);
  assert.equal(JSON.stringify(rows), snapshot);
});
