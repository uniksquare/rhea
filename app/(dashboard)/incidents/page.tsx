import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { queryDsql } from "@/lib/dsql";
import { IncidentsList } from "./incidents-list";

export default async function IncidentsPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  // Fetch initial incidents for the organization
  const res = await queryDsql(
    "SELECT * FROM incidents WHERE org_id = $1 ORDER BY created_at DESC;",
    [session.user.orgId]
  );
  
  const initialIncidents = res.rows;

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Incidents</h1>
        <p className="text-slate text-sm leading-relaxed">
          Monitor and investigate system anomalies, outages, and alerts.
        </p>
      </div>

      <IncidentsList 
        initialIncidents={initialIncidents} 
        userRole={session.user.role} 
      />
    </div>
  );
}
