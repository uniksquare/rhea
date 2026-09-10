import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinRole, type Role } from "@/lib/rbac";
import { updateAssignmentSecrets, SecretValidationError } from "@/lib/platform";

const ERR_MAX = 500;

// PATCH: rotate an assignment's encrypted secrets (OWNER/ADMIN only).
// Body: { publishPass?: string; vercelToken?: string }. An empty string clears
// that key; omitting a key leaves it untouched. Never echoes secret values.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { publishPass, vercelToken } = body as { publishPass?: unknown; vercelToken?: unknown };
  if (publishPass === undefined && vercelToken === undefined) {
    return NextResponse.json({ error: "Nothing to rotate: provide publishPass and/or vercelToken" }, { status: 400 });
  }
  if (publishPass !== undefined && typeof publishPass !== "string") {
    return NextResponse.json({ error: "publishPass must be a string" }, { status: 400 });
  }
  if (vercelToken !== undefined && typeof vercelToken !== "string") {
    return NextResponse.json({ error: "vercelToken must be a string" }, { status: 400 });
  }

  const { id } = await params;
  const orgId = session.user.orgId;

  try {
    const result = await updateAssignmentSecrets(id, orgId, { publishPass, vercelToken });
    return NextResponse.json({ ok: true, rotatedKeys: result.rotatedKeys });
  } catch (err: any) {
    if (err instanceof SecretValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = String(err?.message || err).slice(0, ERR_MAX);
    const status = message === "Assignment not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
