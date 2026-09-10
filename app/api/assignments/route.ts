import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinRole, type Role } from "@/lib/rbac";
import { createAssignment, listAssignments } from "@/lib/platform";
import type { AssignmentConfig, PublishTarget } from "@/lib/assignment-types";

const ROLE_KEYS = new Set(["web-developer", "on-call-engineer"]);

// GET: list this org's assignments (redacted config, never secretsEnc)
export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listAssignments(session.user.orgId);
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}

// POST: create an assignment (OWNER/ADMIN only)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const roleKey = typeof body?.roleKey === "string" ? body.roleKey : "";
  const config = body?.config as Partial<AssignmentConfig> | undefined;
  const secrets =
    body?.secrets && typeof body.secrets === "object" ? (body.secrets as Record<string, unknown>) : undefined;

  if (!name || !ROLE_KEYS.has(roleKey)) {
    return NextResponse.json({ error: "Missing name or invalid roleKey" }, { status: 400 });
  }
  if (!config || !config.repoUrl || !config.workspacePath || !config.publishTarget) {
    return NextResponse.json(
      { error: "config.repoUrl, config.workspacePath and config.publishTarget are required" },
      { status: 400 }
    );
  }

  const target = config.publishTarget as Partial<PublishTarget> & { type?: string };
  let publishTarget: PublishTarget;
  if (target.type === "hostinger-ftp") {
    const t = target as Partial<Extract<PublishTarget, { type: "hostinger-ftp" }>>;
    if (!t.host || !t.user || !t.remoteDir || !t.baseUrl) {
      return NextResponse.json(
        { error: "hostinger-ftp target needs host, user, remoteDir and baseUrl" },
        { status: 400 }
      );
    }
    // The password travels in `secrets.pass`; fold it into publishTarget so
    // createAssignment encrypts it and strips it from the persisted config.
    const pass = typeof secrets?.pass === "string" ? secrets.pass : "";
    publishTarget = {
      type: "hostinger-ftp",
      host: t.host,
      port: typeof t.port === "number" && Number.isFinite(t.port) ? t.port : undefined,
      user: t.user,
      pass,
      remoteDir: t.remoteDir,
      baseUrl: t.baseUrl,
    };
  } else if (target.type === "vercel") {
    const t = target as Partial<Extract<PublishTarget, { type: "vercel" }>>;
    publishTarget = { type: "vercel", projectId: t.projectId || undefined };
  } else {
    return NextResponse.json({ error: "publishTarget.type must be hostinger-ftp or vercel" }, { status: 400 });
  }

  const fullConfig: AssignmentConfig = {
    repoUrl: config.repoUrl,
    workspacePath: config.workspacePath,
    siteDir: config.siteDir || undefined,
    baseBranch: config.baseBranch || undefined,
    publishTarget,
  };

  // `pass` is consumed above; keep any other extra secrets.
  const { pass: _pass, ...extraSecrets } = secrets ?? {};

  try {
    const row = await createAssignment({
      orgId: session.user.orgId,
      roleKey,
      name,
      config: fullConfig,
      secrets: Object.keys(extraSecrets).length > 0 ? extraSecrets : undefined,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err).slice(0, 500) }, { status: 500 });
  }
}
