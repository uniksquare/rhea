import { test } from "node:test";
import assert from "node:assert/strict";
import type { LedgerRow } from "../app/(dashboard)/usage/usage-query.ts";

// usage-query.ts imports lib/db.ts, which constructs a PrismaClient (and a pg
// Pool, lazily) at module scope; that needs DATABASE_URL present in env to
// construct without throwing, even though the pure helpers below never touch
// the database. Matches the guard in tests/db.test.ts.
process.env.DATABASE_URL ??= "postgresql://x:y@localhost:1/z";

const { aggregateUsage, normalizeBilling } = await import("../app/(dashboard)/usage/usage-query.ts");

function row(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    createdAt: new Date("2026-09-10T12:00:00Z"),
    roleKey: "web-developer",
    billing: "api",
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
    costUsd: 1.5,
    ...overrides,
  };
}

test("normalizeBilling treats anything but the literal string 'subscription' as api", () => {
  assert.equal(normalizeBilling("subscription"), "subscription");
  assert.equal(normalizeBilling("api"), "api");
  assert.equal(normalizeBilling(null), "api");
  assert.equal(normalizeBilling(undefined), "api");
  assert.equal(normalizeBilling("SUBSCRIPTION"), "api");
});

test("aggregateUsage sums tokens across billing types but only bills api cost", () => {
  const rows: LedgerRow[] = [
    row({ billing: "api", inputTokens: 100, outputTokens: 50, costUsd: 1.5 }),
    row({ billing: "subscription", inputTokens: 200, outputTokens: 80, costUsd: 0 }),
  ];
  const { totals, subscription } = aggregateUsage(rows);

  assert.equal(totals.inputTokens, 300, "totals include both billing types");
  assert.equal(totals.outputTokens, 130);
  assert.equal(totals.rows, 2);
  assert.equal(totals.costUsd, 1.5, "billed cost is api-only, even though subscription rows carry a nominal cost");

  assert.equal(subscription.inputTokens, 200, "subscription totals only include subscription rows");
  assert.equal(subscription.outputTokens, 80);
  assert.equal(subscription.rows, 1);
});

test("aggregateUsage ignores a nominal cost_usd on subscription rows for the billed total", () => {
  const rows: LedgerRow[] = [row({ billing: "subscription", costUsd: 42 })];
  const { totals } = aggregateUsage(rows);
  assert.equal(totals.costUsd, 0, "subscription runs are not billed even when cost_usd is nonzero");
});

test("aggregateUsage splits byRole per (roleKey, billing) pair", () => {
  const rows: LedgerRow[] = [
    row({ roleKey: "web-developer", billing: "api", inputTokens: 100, costUsd: 1 }),
    row({ roleKey: "web-developer", billing: "subscription", inputTokens: 200, costUsd: 0 }),
    row({ roleKey: "researcher", billing: "api", inputTokens: 300, costUsd: 2 }),
  ];
  const { byRole } = aggregateUsage(rows);

  assert.equal(byRole.length, 3);
  const webApi = byRole.find((r) => r.roleKey === "web-developer" && r.billing === "api");
  const webSub = byRole.find((r) => r.roleKey === "web-developer" && r.billing === "subscription");
  assert.ok(webApi && webSub, "web-developer appears once per billing type");
  assert.equal(webApi!.inputTokens, 100);
  assert.equal(webApi!.costUsd, 1);
  assert.equal(webSub!.inputTokens, 200);
  assert.equal(webSub!.costUsd, 0);

  // Sorted by inputTokens descending.
  assert.equal(byRole[0].roleKey, "researcher");
});

test("aggregateUsage buckets byDay from createdAt (UTC date) and sorts ascending", () => {
  const rows: LedgerRow[] = [
    row({ createdAt: new Date("2026-09-11T23:00:00Z"), inputTokens: 10 }),
    row({ createdAt: new Date("2026-09-09T01:00:00Z"), inputTokens: 20 }),
    row({ createdAt: new Date("2026-09-09T05:00:00Z"), inputTokens: 5 }),
  ];
  const { byDay } = aggregateUsage(rows);

  assert.deepEqual(
    byDay.map((d) => d.day),
    ["2026-09-09", "2026-09-11"]
  );
  assert.equal(byDay[0].inputTokens, 25, "same-day rows are merged");
  assert.equal(byDay[0].rows, 2);
});

test("aggregateUsage buckets a null createdAt under 'unknown' instead of throwing", () => {
  const rows: LedgerRow[] = [row({ createdAt: null })];
  const { byDay } = aggregateUsage(rows);
  assert.equal(byDay.length, 1);
  assert.equal(byDay[0].day, "unknown");
});

test("aggregateUsage returns zeroed totals for an empty ledger", () => {
  const { totals, subscription, byRole, byDay } = aggregateUsage([]);
  assert.deepEqual(totals, {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    rows: 0,
  });
  assert.deepEqual(subscription, {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    rows: 0,
  });
  assert.deepEqual(byRole, []);
  assert.deepEqual(byDay, []);
});
