import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { queryDsql } from "@/lib/dsql";
import { IncidentDetailClient } from "./incident-detail-client";

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const { id: incidentId } = await params;
  const orgId = session.user.orgId;

  // 1. Fetch Incident
  const incRes = await queryDsql(
    "SELECT * FROM incidents WHERE incident_id = $1 AND org_id = $2;",
    [incidentId, orgId]
  );

  if (incRes.rows.length === 0) {
    redirect("/incidents");
  }

  const incident = incRes.rows[0];

  // 2. Fetch Investigation
  const invRes = await queryDsql(
    "SELECT * FROM investigations WHERE incident_id = $1 AND org_id = $2 ORDER BY created_at DESC LIMIT 1;",
    [incidentId, orgId]
  );

  let investigation = null;
  let rootCauses: any[] = [];

  if (invRes.rows.length > 0) {
    investigation = invRes.rows[0];
    // 3. Fetch Root Causes
    const causesRes = await queryDsql(
      "SELECT * FROM root_causes WHERE investigation_id = $1 AND org_id = $2 ORDER BY confidence DESC;",
      [investigation.investigation_id, orgId]
    );
    rootCauses = causesRes.rows;
  }

  // 4. Fetch Fix Patterns
  const patternsRes = await queryDsql(
    "SELECT * FROM fix_patterns WHERE org_id = $1 ORDER BY success_rate DESC;",
    [orgId]
  );

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col p-24">
      <IncidentDetailClient
        initialIncident={incident}
        initialInvestigation={investigation}
        initialRootCauses={rootCauses}
        fixPatterns={patternsRes.rows}
        user={session.user}
      />
    </div>
  );
}
