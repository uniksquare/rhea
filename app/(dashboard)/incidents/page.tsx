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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Incidents</h1>
        <p className="text-zinc-400 text-sm mt-1">
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
