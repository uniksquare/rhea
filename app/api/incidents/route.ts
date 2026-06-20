import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { requirePermission } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "incidents:read");
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");

    let query = "SELECT incident_id, title, description, severity, status, created_at, resolved_at FROM incidents WHERE org_id = $1";
    const params: any[] = [session.user.orgId];
    let paramCounter = 2;

    if (status) {
      query += ` AND status = $${paramCounter}`;
      params.push(status);
      paramCounter++;
    }

    if (severity) {
      query += ` AND severity = $${paramCounter}`;
      params.push(severity);
      paramCounter++;
    }

    query += " ORDER BY created_at DESC;";

    const res = await queryDsql(query, params);
    return NextResponse.json(res.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "incidents:write");
    
    const body = await request.json();
    const { title, description, severity } = body;

    if (!title || !severity) {
      return NextResponse.json({ error: "Missing title or severity" }, { status: 400 });
    }

    const res = await queryDsql(
      `INSERT INTO incidents (org_id, title, description, severity, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING incident_id, title, description, severity, status, created_at;`,
      [session.user.orgId, title, description || null, severity]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}
