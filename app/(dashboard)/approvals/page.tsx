import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAssignments, listTasks } from "@/lib/platform";
import { hasMinRole, hasPermission, type Role } from "@/lib/rbac";
import { groupPendingByAssignment } from "@/lib/approvals";
import { ApprovalsInbox } from "@/app/_components/approvals-inbox";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;
  const [assignmentRows, taskRows] = await Promise.all([listAssignments(orgId), listTasks(orgId)]);

  const assignments = assignmentRows.map((a) => ({
    assignmentId: a.assignmentId,
    name: a.name,
    roleKey: a.roleKey,
  }));

  const tasks = taskRows.map((t) => ({
    taskId: t.taskId,
    assignmentId: t.assignmentId,
    status: t.status,
    request: t.request,
    branch: t.branch,
    previewUrl: t.previewUrl,
    createdAt: t.createdAt ? t.createdAt.toISOString() : null,
  }));

  const groups = groupPendingByAssignment(tasks, assignments);

  const role = session.user.role as Role;
  const canPublish = hasMinRole(role, "ADMIN");
  const canDiscard = hasPermission(role, "tasks:discard");

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Approvals</h1>
        <p className="text-slate text-sm leading-relaxed">
          Every task waiting for sign-off, across all assignments, in one place.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="border border-mist rounded bg-paper-white shadow-sm py-48 text-center text-slate text-sm">
          Nothing waiting for sign-off.
        </div>
      ) : (
        <ApprovalsInbox groups={groups} canPublish={canPublish} canDiscard={canDiscard} />
      )}
    </div>
  );
}
