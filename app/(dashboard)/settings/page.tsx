import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrganization } from "@/lib/tenant";
import { queryDsql } from "@/lib/dsql";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;
  const org = await getOrganization(orgId);
  if (!org) {
    redirect("/");
  }

  // Fetch active API keys
  const keysRes = await queryDsql(
    `SELECT key_id, key_prefix, label, scopes, expires_at, created_at 
     FROM api_keys 
     WHERE org_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC;`,
    [orgId]
  );

  return (
    <div className="space-y-24 max-w-4xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Settings</h1>
        <p className="text-slate text-sm leading-relaxed">
          Configure organization settings, provision programmatic API access, and manage workspace parameters.
        </p>
      </div>

      <SettingsClient 
        organization={org}
        initialApiKeys={keysRes.rows}
        currentUser={session.user}
      />
    </div>
  );
}
