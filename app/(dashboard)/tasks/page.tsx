import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAssignments, listTasks } from "@/lib/platform";
import { hasPermission, type Role } from "@/lib/rbac";
import { TasksHistory } from "@/app/_components/tasks-history";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const orgId = session.user.orgId;
  const [assignmentRows, taskRows] = await Promise.all([listAssignments(orgId), listTasks(orgId)]);

  const assignmentsById = new Map(assignmentRows.map((a) => [a.assignmentId, a]));

  const assignments = assignmentRows.map((a) => ({
    assignmentId: a.assignmentId,
    name: a.name,
  }));

  const tasks = taskRows.map((t) => ({
    taskId: t.taskId,
    assignmentId: t.assignmentId,
    assignmentName: assignmentsById.get(t.assignmentId)?.name ?? "Unknown assignment",
    status: t.status,
    request: t.request,
    branch: t.branch,
    previewUrl: t.previewUrl,
    prUrl: t.prUrl,
    publishedUrl: t.publishedUrl,
    error: t.error,
    createdAt: t.createdAt ? t.createdAt.toISOString() : null,
  }));

  const role = session.user.role as Role;
  const canRevive = hasPermission(role, "tasks:request");
  const canDiscard = hasPermission(role, "tasks:discard");

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <div className="space-y-[4px]">
        <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Tasks</h1>
        <p className="text-slate text-sm leading-relaxed">
          Every task across all assignments, in one filterable history.
        </p>
      </div>

      <TasksHistory tasks={tasks} assignments={assignments} canRevive={canRevive} canDiscard={canDiscard} />
    </div>
  );
}
