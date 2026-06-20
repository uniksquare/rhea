import { auth } from "@/lib/auth";
import { queryDsql } from "@/lib/dsql";
import { requirePermission } from "@/lib/rbac";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "apikeys:manage");

    const res = await queryDsql(
      `SELECT key_id, key_prefix, label, scopes, expires_at, revoked_at, created_at 
       FROM api_keys 
       WHERE org_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC;`,
      [session.user.orgId]
    );

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
    requirePermission(session.user.role, "apikeys:manage");
    const body = await request.json();
    const { label, scopes, expiresDays } = body;

    if (!label) {
      return NextResponse.json({ error: "Missing label" }, { status: 400 });
    }

    // 1. Generate API Key
    const rawKey = "rhea_pk_" + crypto.randomBytes(24).toString("hex");
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 14); // "rhea_pk_xxxxxx"

    // 2. Set Expiration
    let expiresAt: Date | null = null;
    if (expiresDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays));
    }

    // 3. Insert into DSQL
    const res = await queryDsql(
      `INSERT INTO api_keys (org_id, created_by, key_hash, key_prefix, label, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING key_id, key_prefix, label, scopes, expires_at, created_at;`,
      [
        session.user.orgId,
        session.user.id,
        keyHash,
        keyPrefix,
        label,
        JSON.stringify(scopes || ["incidents:read", "agent:execute"]),
        expiresAt
      ]
    );

    // Return the response, adding the raw key which is ONLY returned this once
    return NextResponse.json({
      ...res.rows[0],
      rawKey,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session.user.role, "apikeys:manage");
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json({ error: "Missing keyId" }, { status: 400 });
    }

    const res = await queryDsql(
      `UPDATE api_keys 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE key_id = $1 AND org_id = $2
       RETURNING key_id;`,
      [keyId, session.user.orgId]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: 403 });
  }
}
