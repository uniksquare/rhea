import type { BillingType, UsageByRole, UsageRow } from "./usage-query";

const fmtInt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

const th = "px-[12px] py-[10px] text-left text-[10px] font-mono font-medium text-slate uppercase tracking-wider border-b border-mist whitespace-nowrap";
const thNum = `${th} text-right`;
const td = "px-[12px] py-[10px] text-sm text-graphite-ink border-b border-mist/60 whitespace-nowrap";
const tdNum = `${td} text-right font-mono text-xs`;

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-[12px] py-[32px] text-center text-sm text-slate">
        {text}
      </td>
    </tr>
  );
}

function BillingBadge({ billing }: { billing: BillingType }) {
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

export function UsageTables({ byRole, recent }: { byRole: UsageByRole[]; recent: UsageRow[] }) {
  return (
    <div className="space-y-24">
      {/* Per-role */}
      <div className="rounded border border-mist bg-paper-white p-24 shadow-sm space-y-16">
        <h2 className="font-lustria text-lg font-semibold text-graphite-ink">Usage by Role (30d)</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Role</th>
                <th className={th}>Billing</th>
                <th className={thNum}>Calls</th>
                <th className={thNum}>Tokens In</th>
                <th className={thNum}>Tokens Out</th>
                <th className={thNum}>Cache Read</th>
                <th className={thNum}>Cache Write</th>
                <th className={thNum}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {byRole.length === 0 ? (
                <EmptyRow colSpan={8} text="No usage recorded in the last 30 days." />
              ) : (
                byRole.map((r) => (
                  <tr key={`${r.roleKey}-${r.billing}`} className="hover:bg-soft-snow/50 transition-colors">
                    <td className={`${td} font-medium`}>{r.roleKey}</td>
                    <td className={td}>
                      <BillingBadge billing={r.billing} />
                    </td>
                    <td className={tdNum}>{fmtInt(r.rows)}</td>
                    <td className={tdNum}>{fmtInt(r.inputTokens)}</td>
                    <td className={tdNum}>{fmtInt(r.outputTokens)}</td>
                    <td className={tdNum}>{fmtInt(r.cacheReadTokens)}</td>
                    <td className={tdNum}>{fmtInt(r.cacheWriteTokens)}</td>
                    <td className={tdNum}>{r.billing === "api" ? fmtUsd(r.costUsd) : "n/a"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent */}
      <div className="rounded border border-mist bg-paper-white p-24 shadow-sm space-y-16">
        <h2 className="font-lustria text-lg font-semibold text-graphite-ink">Recent Usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Role</th>
                <th className={th}>Tool</th>
                <th className={th}>Provider</th>
                <th className={th}>Model</th>
                <th className={th}>Billing</th>
                <th className={thNum}>In</th>
                <th className={thNum}>Out</th>
                <th className={thNum}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <EmptyRow colSpan={9} text="No usage rows yet. Usage is recorded on each model call." />
              ) : (
                recent.map((r) => (
                  <tr key={r.usageId} className="hover:bg-soft-snow/50 transition-colors">
                    <td className={`${td} font-mono text-xs text-slate`}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "n/a"}
                    </td>
                    <td className={td}>{r.roleKey}</td>
                    <td className={td}>{r.tool}</td>
                    <td className={td}>{r.provider}</td>
                    <td className={`${td} font-mono text-xs`}>{r.model}</td>
                    <td className={td}>
                      <BillingBadge billing={r.billing} />
                    </td>
                    <td className={tdNum}>{fmtInt(r.inputTokens)}</td>
                    <td className={tdNum}>{fmtInt(r.outputTokens)}</td>
                    <td className={tdNum}>{r.billing === "api" ? fmtUsd(r.costUsd) : "n/a"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
