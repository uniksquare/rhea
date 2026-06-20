import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrgMembers } from "@/lib/tenant";
import { queryDsql } from "@/lib/dsql";
import { TeamClient } from "./team-client";

export default async function TeamPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;

  // 1. Fetch organization members
  const members = await getOrgMembers(orgId);

  // 2. Fetch active API keys
  const keysRes = await queryDsql(
    `SELECT key_id, key_prefix, label, scopes, expires_at, created_at 
     FROM api_keys 
     WHERE org_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC;`,
    [orgId]
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Team & API Keys</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage organization members, assign roles, and provision programmatic API access.
        </p>
      </div>

      <TeamClient
        initialMembers={members}
        initialApiKeys={keysRes.rows}
        currentUser={session.user}
      />
    </div>
  );
}
