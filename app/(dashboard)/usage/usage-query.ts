import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * The ledger's `billing` column (added by a sibling branch's `db push`
 * ahead of this worktree's `prisma/schema.prisma`) is not yet part of the
 * generated Prisma Client model, so every query in this file reads it
 * through `$queryRaw` tagged templates instead of the typed `usageLedger`
 * client. Tagged templates auto-parameterize interpolated values, so this
 * stays just as safe as the typed client for org scoping.
 */

export type BillingType = "api" | "subscription";

/** A row is "api" billed unless the column explicitly says "subscription". */
export function normalizeBilling(value: unknown): BillingType {
  return value === "subscription" ? "subscription" : "api";
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Billed cost: sum of cost_usd where billing = "api" only. */
  costUsd: number;
  rows: number;
}

/** Token totals for runs billing = "subscription": nominal cost is not billed. */
export interface SubscriptionTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  rows: number;
}

export interface UsageByRole extends UsageTotals {
  roleKey: string;
  billing: BillingType;
}

export interface UsageByDay extends UsageTotals {
  day: string;
}

export interface UsageRow {
  usageId: string;
  createdAt: string | null;
  roleKey: string;
  tool: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  billing: BillingType;
}

export interface UsageSummary {
  since: string;
  totals: UsageTotals;
  subscription: SubscriptionTotals;
  byRole: UsageByRole[];
  byDay: UsageByDay[];
  recent: UsageRow[];
}

/** A ledger row normalized to plain JS numbers, ready for pure aggregation. */
export interface LedgerRow {
  createdAt: Date | null;
  roleKey: string;
  billing: BillingType;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
};

function emptyTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, rows: 0 };
}

function emptySubscriptionTotals(): SubscriptionTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, rows: 0 };
}

/**
 * Pure aggregation over already-fetched ledger rows: overall totals (with
 * billed-only cost), subscription-only token totals, and per-role / per-day
 * breakdowns. No I/O, so this is the piece covered by unit tests.
 */
export function aggregateUsage(rows: LedgerRow[]): {
  totals: UsageTotals;
  subscription: SubscriptionTotals;
  byRole: UsageByRole[];
  byDay: UsageByDay[];
} {
  const totals = emptyTotals();
  const subscription = emptySubscriptionTotals();
  const roleMap = new Map<string, UsageByRole>();
  const dayMap = new Map<string, UsageByDay>();

  for (const row of rows) {
    const billing = normalizeBilling(row.billing);

    totals.inputTokens += row.inputTokens;
    totals.outputTokens += row.outputTokens;
    totals.cacheReadTokens += row.cacheReadTokens;
    totals.cacheWriteTokens += row.cacheWriteTokens;
    totals.rows += 1;

    if (billing === "api") {
      totals.costUsd += row.costUsd;
    } else {
      subscription.inputTokens += row.inputTokens;
      subscription.outputTokens += row.outputTokens;
      subscription.cacheReadTokens += row.cacheReadTokens;
      subscription.cacheWriteTokens += row.cacheWriteTokens;
      subscription.rows += 1;
    }

    const roleKey = `${row.roleKey}::${billing}`;
    const roleEntry =
      roleMap.get(roleKey) ??
      ({ roleKey: row.roleKey, billing, ...emptyTotals() } satisfies UsageByRole);
    roleEntry.inputTokens += row.inputTokens;
    roleEntry.outputTokens += row.outputTokens;
    roleEntry.cacheReadTokens += row.cacheReadTokens;
    roleEntry.cacheWriteTokens += row.cacheWriteTokens;
    roleEntry.rows += 1;
    if (billing === "api") roleEntry.costUsd += row.costUsd;
    roleMap.set(roleKey, roleEntry);

    const day = row.createdAt ? row.createdAt.toISOString().slice(0, 10) : "unknown";
    const dayEntry = dayMap.get(day) ?? ({ day, ...emptyTotals() } satisfies UsageByDay);
    dayEntry.inputTokens += row.inputTokens;
    dayEntry.outputTokens += row.outputTokens;
    dayEntry.cacheReadTokens += row.cacheReadTokens;
    dayEntry.cacheWriteTokens += row.cacheWriteTokens;
    dayEntry.rows += 1;
    if (billing === "api") dayEntry.costUsd += row.costUsd;
    dayMap.set(day, dayEntry);
  }

  const byRole = [...roleMap.values()].sort((a, b) => b.inputTokens - a.inputTokens);
  const byDay = [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day));

  return { totals, subscription, byRole, byDay };
}

export async function getUsageSummary(orgId: string, days = 30): Promise<UsageSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [ledgerRows, recentRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        created_at: Date | null;
        role_key: string;
        billing: string;
        input_tokens: number;
        output_tokens: number;
        cache_read_tokens: number;
        cache_write_tokens: number;
        cost_usd: Prisma.Decimal | string | number;
      }>
    >`
      SELECT created_at,
             role_key,
             billing,
             input_tokens,
             output_tokens,
             cache_read_tokens,
             cache_write_tokens,
             cost_usd
      FROM usage_ledger
      WHERE org_id = ${orgId}::uuid AND created_at >= ${since}
    `,
    prisma.$queryRaw<
      Array<{
        usage_id: string;
        created_at: Date | null;
        role_key: string;
        tool: string;
        provider: string;
        model: string;
        input_tokens: number;
        output_tokens: number;
        cache_read_tokens: number;
        cache_write_tokens: number;
        cost_usd: Prisma.Decimal | string | number;
        billing: string;
      }>
    >`
      SELECT usage_id,
             created_at,
             role_key,
             tool,
             provider,
             model,
             input_tokens,
             output_tokens,
             cache_read_tokens,
             cache_write_tokens,
             cost_usd,
             billing
      FROM usage_ledger
      WHERE org_id = ${orgId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `,
  ]);

  const rows: LedgerRow[] = ledgerRows.map((r) => ({
    createdAt: r.created_at,
    roleKey: r.role_key,
    billing: normalizeBilling(r.billing),
    inputTokens: num(r.input_tokens),
    outputTokens: num(r.output_tokens),
    cacheReadTokens: num(r.cache_read_tokens),
    cacheWriteTokens: num(r.cache_write_tokens),
    costUsd: num(r.cost_usd),
  }));

  const { totals, subscription, byRole, byDay } = aggregateUsage(rows);

  return {
    since: since.toISOString(),
    totals,
    subscription,
    byRole,
    byDay,
    recent: recentRows.map((r) => ({
      usageId: r.usage_id,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      roleKey: r.role_key,
      tool: r.tool,
      provider: r.provider,
      model: r.model,
      inputTokens: num(r.input_tokens),
      outputTokens: num(r.output_tokens),
      cacheReadTokens: num(r.cache_read_tokens),
      cacheWriteTokens: num(r.cache_write_tokens),
      costUsd: num(r.cost_usd),
      billing: normalizeBilling(r.billing),
    })),
  };
}
