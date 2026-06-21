import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { queryDsql } from "@/lib/dsql";
import Link from "next/link";
import { 
  AlertTriangle, 
  Clock, 
  Activity, 
  CheckCircle2, 
  ChevronRight, 
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function OverviewPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;

  // 1. Fetch Metrics
  const activeCountRes = await queryDsql(
    "SELECT COUNT(*) FROM incidents WHERE org_id = $1 AND status IN ('ACTIVE', 'INVESTIGATING');",
    [orgId]
  );
  const activeCount = parseInt(activeCountRes.rows[0]?.count || "0");

  const totalCountRes = await queryDsql(
    "SELECT COUNT(*) FROM incidents WHERE org_id = $1;",
    [orgId]
  );
  const totalCount = parseInt(totalCountRes.rows[0]?.count || "0");

  const resolvedCountRes = await queryDsql(
    "SELECT COUNT(*) FROM incidents WHERE org_id = $1 AND status = 'RESOLVED';",
    [orgId]
  );
  const resolvedCount = parseInt(resolvedCountRes.rows[0]?.count || "0");

  const mttrRes = await queryDsql(
    `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))/60 AS mttr_mins 
     FROM incidents 
     WHERE org_id = $1 AND status = 'RESOLVED' AND resolved_at IS NOT NULL;`,
    [orgId]
  );
  const rawMttr = parseFloat(mttrRes.rows[0]?.mttr_mins || "0");
  const mttr = rawMttr > 0 ? `${Math.round(rawMttr)}m` : "N/A";

  const autonomyRate = totalCount > 0 
    ? `${Math.round((resolvedCount / totalCount) * 100)}%` 
    : "100%";

  // 2. Fetch Recent Incidents
  const recentIncidentsRes = await queryDsql(
    `SELECT incident_id, title, severity, status, created_at 
     FROM incidents 
     WHERE org_id = $1 
     ORDER BY created_at DESC 
     LIMIT 5;`,
    [orgId]
  );
  const recentIncidents = recentIncidentsRes.rows;

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      {/* Header */}
      <div className="flex flex-col gap-[12px] md:flex-row md:items-center md:justify-between">
        <div className="space-y-[4px]">
          <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Dashboard Overview</h1>
          <p className="text-slate text-sm leading-relaxed">
            System status and incident response telemetry for your organization.
          </p>
        </div>
        <div className="flex items-center gap-[12px]">
          <Link href="/chat">
            <button className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none">
              Report Incident
              <ArrowUpRight className="size-[14px]" />
            </button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-16 md:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Active Incidents</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{activeCount}</p>
          </div>
          <div className={`p-[12px] rounded border ${activeCount > 0 ? 'bg-rose-50/50 text-rose-600 border-rose-100 animate-pulse' : 'bg-paper-white text-slate border-mist'}`}>
            <AlertTriangle className="size-[20px]" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Mean Time to Resolve</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{mttr}</p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-slate border-mist">
            <Clock className="size-[20px]" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Autonomy Rate</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{autonomyRate}</p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-iris-violet border-mist">
            <Activity className="size-[20px]" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded border border-mist bg-soft-snow p-24 flex items-center justify-between shadow-sm">
          <div className="space-y-[4px]">
            <p className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Total Handled</p>
            <p className="text-3xl font-bold text-graphite-ink tracking-tight">{totalCount}</p>
          </div>
          <div className="p-[12px] rounded border bg-paper-white text-emerald-600 border-mist">
            <CheckCircle2 className="size-[20px]" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-24 md:grid-cols-6">
        {/* Recent Incidents Panel */}
        <div className="md:col-span-4 rounded border border-mist bg-paper-white p-24 flex flex-col justify-between shadow-sm">
          <div className="space-y-16">
            <div className="flex items-center justify-between">
              <h2 className="font-lustria text-lg font-semibold text-graphite-ink">Recent Incidents</h2>
              <Link href="/incidents" className="font-mono text-[11px] uppercase tracking-wider text-iris-violet hover:text-deep-iris flex items-center gap-[4px] transition-colors">
                View all
                <ChevronRight className="size-[12px]" />
              </Link>
            </div>

            <div className="space-y-[12px]">
              {recentIncidents.length === 0 ? (
                <div className="text-center py-[32px] border border-dashed border-mist rounded bg-soft-snow/50">
                  <p className="text-slate text-sm">No incidents recorded yet.</p>
                </div>
              ) : (
                recentIncidents.map((incident: any) => {
                  const severityColors: any = {
                    LOW: 'bg-slate/5 text-slate border-slate/15',
                    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
                    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
                    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
                  };
                  const statusColors: any = {
                    ACTIVE: 'bg-rose-50 text-rose-700 border-rose-200',
                    INVESTIGATING: 'bg-iris-violet/5 text-iris-violet border-iris-violet/15',
                    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  };

                  return (
                    <Link
                      key={incident.incident_id}
                      href={`/incidents/${incident.incident_id}`}
                      className="flex items-center justify-between p-[14px] rounded border border-mist bg-soft-snow/30 hover:bg-soft-snow/70 hover:border-slate/30 transition-all group"
                    >
                      <div className="flex flex-col gap-[2px] min-w-0">
                        <span className="text-sm font-medium text-graphite-ink group-hover:text-iris-violet transition-colors truncate">
                          {incident.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate/80">
                          {new Date(incident.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-[8px] shrink-0">
                        <span className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${severityColors[incident.severity]}`}>
                          {incident.severity}
                        </span>
                        <span className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${statusColors[incident.status]}`}>
                          {incident.status}
                        </span>
                        <ChevronRight className="size-[16px] text-slate/40 group-hover:text-iris-violet transition-colors ml-[4px]" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Agent Telemetry Panel */}
        <div className="md:col-span-2 rounded border border-mist bg-paper-white p-24 flex flex-col justify-between shadow-sm">
          <div className="space-y-[16px]">
            <h2 className="font-lustria text-lg font-semibold text-graphite-ink">Rhea Copilot</h2>

            <div className="border border-mist bg-soft-snow p-16 rounded flex items-start gap-[12px]">
              <div className="p-[8px] rounded border border-emerald-200 bg-emerald-50 text-emerald-600 mt-[2px] shrink-0">
                <Activity className="size-[16px] animate-pulse" />
              </div>
              <div className="space-y-[4px]">
                <p className="text-sm font-semibold text-graphite-ink">Agent Status</p>
                <p className="text-xs text-emerald-600 font-semibold">Active & Monitoring</p>
                <p className="text-xs text-slate mt-[4px] leading-relaxed">
                  Ready to trigger investigations or run automated sandboxes.
                </p>
              </div>
            </div>

            <div className="space-y-[12px] text-xs text-slate font-sans">
              <div className="flex justify-between border-b border-mist pb-[8px]">
                <span>Active Channels</span>
                <span className="text-graphite-ink font-medium">Web Chat, Local Dev</span>
              </div>
              <div className="flex justify-between border-b border-mist pb-[8px]">
                <span>Active Integrations</span>
                <span className="text-graphite-ink font-medium">Aurora DSQL, DynamoDB</span>
              </div>
              <div className="flex justify-between pb-[4px]">
                <span>Remediation Library</span>
                <span className="text-graphite-ink font-medium">3 active templates</span>
              </div>
            </div>
          </div>

          <div className="mt-24 pt-16 border-t border-mist">
            <Link href="/chat" className="w-full block">
              <button className="w-full bg-paper-white hover:bg-soft-snow text-graphite-ink border border-mist hover:border-slate/40 rounded py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none text-center block">
                Launch General Chat
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
