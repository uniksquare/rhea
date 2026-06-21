import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrgMembers } from "@/lib/tenant";
import { TeamClient } from "./team-client";

export default async function TeamPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;

  // 1. Fetch organization members
  const members = await getOrgMembers(orgId);

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Team Management</h1>
        <p className="text-slate text-sm leading-relaxed">
          Manage organization members, assign roles, and handle collaborative access permissions.
        </p>
      </div>

      <TeamClient
        initialMembers={members}
        currentUser={session.user}
      />
    </div>
  );
}
