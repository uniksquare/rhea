import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAssignments } from "@/lib/platform";
import { AssignmentsList } from "@/app/_components/assignments-list";

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const rows = await listAssignments(session.user.orgId);
  const initialAssignments = rows.map((a) => ({
    assignmentId: a.assignmentId,
    name: a.name,
    roleKey: a.roleKey,
    status: a.status,
    createdAt: a.createdAt ? a.createdAt.toISOString() : null,
  }));

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Assignments</h1>
        <p className="text-slate text-sm leading-relaxed">
          Each assignment is rhea doing one role for one repo. Open one to see its tasks.
        </p>
      </div>

      <AssignmentsList initialAssignments={initialAssignments} userRole={session.user.role} />
    </div>
  );
}
