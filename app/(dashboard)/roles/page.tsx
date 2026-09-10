import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowRight } from "lucide-react";
import { RoleCard } from "./role-card";

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const roles = await prisma.role.findMany({
    select: {
      roleKey: true,
      name: true,
      description: true,
      manifest: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">
          Roles
        </h1>
        <p className="text-slate text-sm leading-relaxed max-w-2xl">
          The kinds of jobs rhea can do. Each Role is a job description: its
          brain, workspace, playbooks, tools, and what needs sign-off.
        </p>
      </div>

      {roles.length === 0 ? (
        <div className="p-48 border border-dashed border-mist text-center space-y-8 rounded bg-soft-snow/35">
          <p className="text-slate text-sm">No roles have been seeded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
          {roles.map((role) => (
            <RoleCard key={role.roleKey} role={role} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-[6px] text-xs text-slate pt-8">
        <span>Create an Assignment to put rhea in this role.</span>
        <Link
          href="/assignments"
          className="inline-flex items-center gap-[4px] text-iris-violet hover:underline font-medium"
        >
          Go to Assignments
          <ArrowRight className="size-[12px]" />
        </Link>
      </div>
    </div>
  );
}
