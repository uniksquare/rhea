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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-zinc-400 text-sm mt-1">
            System status and incident response telemetry for your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/incidents">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg shadow-purple-500/20 gap-2">
              Report Incident
              <ArrowUpRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Incidents</p>
            <p className="text-3xl font-semibold text-white">{activeCount}</p>
          </div>
          <div className={`p-3 rounded-lg ${activeCount > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
            <AlertTriangle className="size-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Mean Time to Resolve</p>
            <p className="text-3xl font-semibold text-white">{mttr}</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Clock className="size-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Autonomy Rate</p>
            <p className="text-3xl font-semibold text-white">{autonomyRate}</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800 text-purple-400 border border-zinc-700">
            <Activity className="size-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Handled</p>
            <p className="text-3xl font-semibold text-white">{totalCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700">
            <CheckCircle2 className="size-5" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-6">
        {/* Recent Incidents Panel */}
        <div className="md:col-span-4 rounded-xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Incidents</h2>
              <Link href="/incidents" className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
                View all
                <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentIncidents.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg">
                  <p className="text-zinc-500 text-sm">No incidents recorded yet.</p>
                </div>
              ) : (
                recentIncidents.map((incident: any) => {
                  const severityColors: any = {
                    LOW: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                    HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
                  };
                  const statusColors: any = {
                    ACTIVE: 'bg-red-500/10 text-red-400 border-red-500/20',
                    INVESTIGATING: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  };

                  return (
                    <Link
                      key={incident.incident_id}
                      href={`/incidents/${incident.incident_id}`}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all group"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                          {incident.title}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(incident.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${severityColors[incident.severity]}`}>
                          {incident.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColors[incident.status]}`}>
                          {incident.status}
                        </span>
                        <ChevronRight className="size-4 text-zinc-600 group-hover:text-zinc-400 transition-colors ml-1" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Agent Telemetry Panel */}
        <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Rhea Copilot</h2>

            <div className="border border-zinc-800 bg-zinc-950 p-4 rounded-lg flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                <Activity className="size-4 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-200">Agent Status</p>
                <p className="text-xs text-emerald-400 font-semibold">Active & Monitoring</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Ready to trigger investigations or run automated sandboxes.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span>Active Channels</span>
                <span className="text-zinc-200 font-medium">Web Chat, Local Dev</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span>Active Integrations</span>
                <span className="text-zinc-200 font-medium">Aurora DSQL, DynamoDB</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>Remediation Library</span>
                <span className="text-zinc-200 font-medium">3 active templates</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800">
            <Link href="/" className="w-full block">
              <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 hover:text-white">
                Launch General Chat
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
