import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { redirect } from "next/navigation";
import { SandboxClient } from "./sandbox-client";

export default async function SandboxPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;

  // 1. Fetch the latest active sandbox session for this org
  const sessionRes = await queryDsql(
    `SELECT session_id, org_id, user_id, status, allowed_domains, config_limits, created_at, updated_at
     FROM sandbox_sessions
     WHERE org_id = $1
     ORDER BY updated_at DESC
     LIMIT 1;`,
    [orgId]
  );

  const activeSession = sessionRes.rows[0] || null;

  // 2. Fetch the recent 50 executions for this org
  const executionsRes = await queryDsql(
    `SELECT e.execution_id, e.session_id, e.command, e.status, e.exit_code, e.stdout, e.stderr, e.execution_time_ms, e.created_at
     FROM sandbox_executions e
     JOIN sandbox_sessions s ON e.session_id = s.session_id
     WHERE s.org_id = $1
     ORDER BY e.created_at DESC
     LIMIT 50;`,
    [orgId]
  );

  const executions = executionsRes.rows.map((row) => ({
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

  // Parse allowed domains and config limits if present
  let allowedDomains: string[] = ["github.com", "api.github.com"];
  let configLimits = { memoryMiB: 2048, vcpus: 4 };

  if (activeSession) {
    try {
      if (activeSession.allowed_domains) {
        allowedDomains = typeof activeSession.allowed_domains === "string"
          ? JSON.parse(activeSession.allowed_domains)
          : activeSession.allowed_domains;
      }
      if (activeSession.config_limits) {
        configLimits = typeof activeSession.config_limits === "string"
          ? JSON.parse(activeSession.config_limits)
          : activeSession.config_limits;
      }
    } catch (e) {
      console.error("[sandbox-page] Failed to parse JSON fields:", e);
    }
  }

  return (
    <SandboxClient
      initialSession={activeSession ? {
        sessionId: activeSession.session_id,
        status: activeSession.status,
        allowedDomains,
        configLimits,
        createdAt: activeSession.created_at.toISOString(),
        updatedAt: activeSession.updated_at.toISOString(),
      } : null}
      initialExecutions={executions}
      user={{
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        orgId: session.user.orgId,
      }}
    />
  );
}
