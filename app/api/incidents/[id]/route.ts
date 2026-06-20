import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { requirePermission } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: incidentId } = await params;
  const orgId = session.user.orgId;

  try {
    requirePermission(session.user.role, "incidents:read");

    // 1. Fetch Incident
    const incRes = await queryDsql(
      "SELECT * FROM incidents WHERE incident_id = $1 AND org_id = $2;",
      [incidentId, orgId]
    );

    if (incRes.rows.length === 0) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
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

    // 4. Fetch Fix Patterns (remediation templates)
    const patternsRes = await queryDsql(
      "SELECT * FROM fix_patterns WHERE org_id = $1 ORDER BY success_rate DESC;",
      [orgId]
    );

    return NextResponse.json({
      incident,
      investigation,
      rootCauses,
      fixPatterns: patternsRes.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: incidentId } = await params;
  const orgId = session.user.orgId;

  try {
    requirePermission(session.user.role, "incidents:write");
    const body = await request.json();

    // Check if incident exists
    const checkRes = await queryDsql(
      "SELECT status FROM incidents WHERE incident_id = $1 AND org_id = $2;",
      [incidentId, orgId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const currentIncident = checkRes.rows[0];
    const updates: string[] = [];
    const values: any[] = [incidentId, orgId];
    let counter = 3;

    if (body.status !== undefined) {
      updates.push(`status = $${counter}`);
      values.push(body.status);
      counter++;

      if (body.status === "RESOLVED" && currentIncident.status !== "RESOLVED") {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      } else if (body.status !== "RESOLVED") {
        updates.push(`resolved_at = NULL`);
      }
    }

    if (body.severity !== undefined) {
      updates.push(`severity = $${counter}`);
      values.push(body.severity);
      counter++;
    }

    if (body.agent_session_state !== undefined) {
      updates.push(`agent_session_state = $${counter}`);
      values.push(JSON.stringify(body.agent_session_state));
      counter++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const query = `
      UPDATE incidents 
      SET ${updates.join(", ")}
      WHERE incident_id = $1 AND org_id = $2
      RETURNING *;
    `;

    const res = await queryDsql(query, values);
    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}
