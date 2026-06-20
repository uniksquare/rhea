import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrganization } from "@/lib/tenant";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const org = await getOrganization(session.user.orgId);
  if (!org) {
    redirect("/");
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Configure organization settings, connector integrations, and workspace parameters.
        </p>
      </div>

      <SettingsClient 
        organization={org}
        userRole={session.user.role}
      />
    </div>
  );
}
