/**
 * Pure aggregation of a single Task's usage ledger rows. No I/O here; see
 * lib/platform.ts:getTaskUsage for the query that produces the rows this
 * consumes.
 */

export type TaskUsageBilling = "api" | "subscription";

/** A ledger row scoped to one task, normalized to plain JS numbers. */
export interface TaskUsageRow {
  createdAt: Date | null;
  tool: string;
  provider: string;
  model: string;
  billing: TaskUsageBilling;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export interface TaskToolUsage {
  turns: number;
  inputTokens: number;
  outputTokens: number;
}

export interface TaskUsageSummary {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Sum of costUsd where billing === "api" only. */
  billedCostUsd: number;
  /** Count of rows where billing === "subscription". */
  subscriptionTurns: number;
  byTool: Record<string, TaskToolUsage>;
}

function emptySummary(): TaskUsageSummary {
  return {
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    billedCostUsd: 0,
    subscriptionTurns: 0,
    byTool: {},
  };
}

/**
 * Aggregate a task's usage ledger rows (already scoped to one taskId) into
 * totals, billed cost, and a per-tool breakdown. Pure: never mutates `rows`.
 */
export function summarizeTaskUsage(rows: TaskUsageRow[]): TaskUsageSummary {
  const summary = emptySummary();

  for (const row of rows) {
    summary.turns += 1;
    summary.inputTokens += row.inputTokens;
    summary.outputTokens += row.outputTokens;
    summary.cacheReadTokens += row.cacheReadTokens;
    summary.cacheWriteTokens += row.cacheWriteTokens;

    if (row.billing === "api") {
      summary.billedCostUsd += row.costUsd;
    } else {
      summary.subscriptionTurns += 1;
    }

    const tool = summary.byTool[row.tool] ?? { turns: 0, inputTokens: 0, outputTokens: 0 };
    tool.turns += 1;
    tool.inputTokens += row.inputTokens;
    tool.outputTokens += row.outputTokens;
    summary.byTool[row.tool] = tool;
  }

  return summary;
}
