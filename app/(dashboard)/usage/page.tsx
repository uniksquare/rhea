import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, DollarSign, ShieldCheck } from "lucide-react";
import { getUsageSummary, type UsageSummary } from "./usage-query";
import { UsageTables } from "./usage-tables";

const EMPTY: UsageSummary = {
  since: new Date().toISOString(),
  totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, rows: 0 },
  subscription: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, rows: 0 },
  byRole: [],
  byDay: [],
  recent: [],
};

const fmtInt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  let summary: UsageSummary = EMPTY;
  let loadError: string | null = null;
  try {
    summary = await getUsageSummary(session.user.orgId, 30);
  } catch (err: any) {
    console.error("[usage page] failed to load usage:", err?.message || err);
    loadError = "Usage data is unavailable right now.";
  }

  const { totals, subscription } = summary;

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Usage</h1>
        <p className="text-slate text-sm leading-relaxed">
          LLM token consumption and cost for your organization over the last 30 days.
        </p>
      </div>

      {loadError && (
        <div className="rounded border border-rose-200 bg-rose-50 p-16 text-sm text-rose-700">{loadError}</div>
      )}

      {/* Metrics Row */}
      <div className="grid gap-16 md:grid-cols-4">
        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Tokens In (30d)</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{fmtInt(totals.inputTokens)}</p>
            <p className="text-[10px] font-mono text-slate/80">
              cache read {fmtInt(totals.cacheReadTokens)} / write {fmtInt(totals.cacheWriteTokens)}
            </p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-iris-violet border-mist">
            <ArrowDownToLine className="size-[20px]" />
          </div>
        </div>

        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Tokens Out (30d)</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{fmtInt(totals.outputTokens)}</p>
            <p className="text-[10px] font-mono text-slate/80">{fmtInt(totals.rows)} model calls</p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-emerald-600 border-mist">
            <ArrowUpFromLine className="size-[20px]" />
          </div>
        </div>

        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Billed (API) (30d)</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{fmtUsd(totals.costUsd)}</p>
            <p className="text-[10px] font-mono text-slate/80">since {summary.since.slice(0, 10)}</p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-amber-600 border-mist">
            <DollarSign className="size-[20px]" />
          </div>
        </div>

        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Covered by Subscription</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">
              {fmtInt(subscription.inputTokens + subscription.outputTokens)}
            </p>
            <p className="text-[10px] font-mono text-slate/80">{fmtInt(subscription.rows)} model calls, not billed</p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-sky-600 border-mist">
            <ShieldCheck className="size-[20px]" />
          </div>
        </div>
      </div>

      <UsageTables byRole={summary.byRole} recent={summary.recent} />
    </div>
  );
}
