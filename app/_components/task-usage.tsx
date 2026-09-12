import { summarizeTaskUsage, type TaskUsageRow } from "@/lib/task-usage";

const fmtInt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

const labelCls = "font-mono uppercase tracking-wider text-[10px] text-slate";
const th = "px-[12px] py-[10px] text-left text-[10px] font-mono font-medium text-slate uppercase tracking-wider border-b border-mist whitespace-nowrap";
const thNum = `${th} text-right`;
const td = "px-[12px] py-[10px] text-sm text-graphite-ink border-b border-mist/60 whitespace-nowrap";
const tdNum = `${td} text-right font-mono text-xs`;

function BillingBadge({ billing }: { billing: "api" | "subscription" }) {
  const isApi = billing === "api";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-[8px] py-[2px] text-[10px] font-mono font-medium uppercase tracking-wider ${
        isApi ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isApi ? "API" : "Subscription"}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-[2px]">
      <div className={labelCls}>{label}</div>
      <div className="font-mono text-sm text-graphite-ink">{value}</div>
    </div>
  );
}

/** Plain, already-fetched usage rows for one task; passed in by a server component. */
export interface TaskUsageProps {
  rows: TaskUsageRow[];
}

export function TaskUsage({ rows }: TaskUsageProps) {
  const summary = summarizeTaskUsage(rows);
  const tools = Object.entries(summary.byTool).sort((a, b) => b[1].turns - a[1].turns);

  if (summary.turns === 0) {
    return (
      <div className="border border-mist rounded bg-paper-white shadow-sm p-16">
        <p className="text-sm text-slate">No usage recorded for this task yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <div className="border border-mist rounded bg-paper-white shadow-sm p-16">
        <div className="grid grid-cols-2 gap-16 sm:grid-cols-3 md:grid-cols-6">
          <Stat label="Turns" value={fmtInt(summary.turns)} />
          <Stat label="Tokens In" value={fmtInt(summary.inputTokens)} />
          <Stat label="Tokens Out" value={fmtInt(summary.outputTokens)} />
          <Stat label="Cache Read" value={fmtInt(summary.cacheReadTokens)} />
          <Stat label="Cache Write" value={fmtInt(summary.cacheWriteTokens)} />
          <Stat
            label="Billed"
            value={
              summary.billedCostUsd > 0
                ? fmtUsd(summary.billedCostUsd)
                : summary.subscriptionTurns > 0
                  ? "Covered by subscription"
                  : fmtUsd(0)
            }
          />
        </div>
      </div>

      {tools.length > 0 && (
        <div className="border border-mist rounded bg-paper-white shadow-sm p-16 space-y-[8px]">
          <h3 className={labelCls}>By tool</h3>
          <ul className="space-y-[4px]">
            {tools.map(([tool, t]) => (
              <li key={tool} className="flex items-center justify-between text-sm">
                <span className="text-graphite-ink">{tool}</span>
                <span className="font-mono text-xs text-slate">
                  {fmtInt(t.turns)} {t.turns === 1 ? "turn" : "turns"} · {fmtInt(t.inputTokens)} in / {fmtInt(t.outputTokens)} out
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border border-mist rounded bg-paper-white shadow-sm p-16 space-y-16">
        <h3 className={labelCls}>Per turn</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Tool</th>
                <th className={th}>Model</th>
                <th className={thNum}>In</th>
                <th className={thNum}>Out</th>
                <th className={th}>Billing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-soft-snow/50 transition-colors">
                  <td className={`${td} font-mono text-xs text-slate`}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "n/a"}
                  </td>
                  <td className={td}>{r.tool}</td>
                  <td className={`${td} font-mono text-xs`}>{r.model}</td>
                  <td className={tdNum}>{fmtInt(r.inputTokens)}</td>
                  <td className={tdNum}>{fmtInt(r.outputTokens)}</td>
                  <td className={td}>
                    <BillingBadge billing={r.billing} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
