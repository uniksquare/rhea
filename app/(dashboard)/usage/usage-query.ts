import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  rows: number;
}

export interface UsageByRole extends UsageTotals {
  roleKey: string;
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
}

export interface UsageSummary {
  since: string;
  totals: UsageTotals;
  byRole: UsageByRole[];
  byDay: UsageByDay[];
  recent: UsageRow[];
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
};

export async function getUsageSummary(orgId: string, days = 30): Promise<UsageSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { orgId, createdAt: { gte: since } };

  const [agg, roleGroups, dayRows, recentRows] = await Promise.all([
    prisma.usageLedger.aggregate({
      where,
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costUsd: true,
      },
      _count: { _all: true },
    }),
    prisma.usageLedger.groupBy({
      by: ["roleKey"],
      where,
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costUsd: true,
      },
      _count: { _all: true },
      orderBy: { _sum: { inputTokens: "desc" } },
    }),
    prisma.$queryRaw<
      Array<{
        day: Date;
        input_tokens: bigint | number | null;
        output_tokens: bigint | number | null;
        cache_read_tokens: bigint | number | null;
        cache_write_tokens: bigint | number | null;
        cost_usd: Prisma.Decimal | string | number | null;
        rows: bigint | number;
      }>
    >`
      SELECT date_trunc('day', created_at) AS day,
             SUM(input_tokens) AS input_tokens,
             SUM(output_tokens) AS output_tokens,
             SUM(cache_read_tokens) AS cache_read_tokens,
             SUM(cache_write_tokens) AS cache_write_tokens,
             SUM(cost_usd) AS cost_usd,
             COUNT(*) AS rows
      FROM usage_ledger
      WHERE org_id = ${orgId}::uuid AND created_at >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.usageLedger.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        usageId: true,
        createdAt: true,
        roleKey: true,
        tool: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costUsd: true,
      },
    }),
  ]);

  return {
    since: since.toISOString(),
    totals: {
      inputTokens: num(agg._sum.inputTokens),
      outputTokens: num(agg._sum.outputTokens),
      cacheReadTokens: num(agg._sum.cacheReadTokens),
      cacheWriteTokens: num(agg._sum.cacheWriteTokens),
      costUsd: num(agg._sum.costUsd),
      rows: agg._count._all,
    },
    byRole: roleGroups.map((g) => ({
      roleKey: g.roleKey,
      inputTokens: num(g._sum.inputTokens),
      outputTokens: num(g._sum.outputTokens),
      cacheReadTokens: num(g._sum.cacheReadTokens),
      cacheWriteTokens: num(g._sum.cacheWriteTokens),
      costUsd: num(g._sum.costUsd),
      rows: g._count._all,
    })),
    byDay: dayRows.map((d) => ({
      day: new Date(d.day).toISOString().slice(0, 10),
      inputTokens: num(d.input_tokens),
      outputTokens: num(d.output_tokens),
      cacheReadTokens: num(d.cache_read_tokens),
      cacheWriteTokens: num(d.cache_write_tokens),
      costUsd: num(d.cost_usd),
      rows: num(d.rows),
    })),
    recent: recentRows.map((r) => ({
      usageId: r.usageId,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      roleKey: r.roleKey,
      tool: r.tool,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheWriteTokens: r.cacheWriteTokens,
      costUsd: num(r.costUsd),
    })),
  };
}
