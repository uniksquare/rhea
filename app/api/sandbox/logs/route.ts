import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;

  try {
    const res = await queryDsql(
      `SELECT e.execution_id, e.session_id, e.command, e.status, e.exit_code, e.stdout, e.stderr, e.execution_time_ms, e.created_at
       FROM sandbox_executions e
       JOIN sandbox_sessions s ON e.session_id = s.session_id
       WHERE s.org_id = $1
       ORDER BY e.created_at DESC
       LIMIT 50;`,
      [orgId]
    );

    const executions = res.rows.map((row) => ({
      executionId: row.execution_id,
      sessionId: row.session_id,
      command: row.command,
      status: row.status,
      exitCode: row.exit_code,
      stdout: row.stdout || "",
      stderr: row.stderr || "",
      executionTimeMs: row.execution_time_ms,
      createdAt: row.created_at.toISOString(),
    }));

    return NextResponse.json(executions);
  } catch (err: any) {
    console.error("[sandbox-logs-api] GET failed:", err.message);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
