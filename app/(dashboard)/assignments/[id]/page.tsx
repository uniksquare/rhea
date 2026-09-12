import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAssignment, listTasks } from "@/lib/platform";
import { hasMinRole, type Role } from "@/lib/rbac";
import { roleLabel, formatDate } from "@/lib/assignment-ui";
import { AssignmentTasks } from "@/app/_components/assignments-tasks";
import { AssignmentSecrets } from "@/app/_components/assignment-secrets";

function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && (value.startsWith("https://") || value.startsWith("http://"));
}

interface AssignmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const orgId = session.user.orgId;

  const assignment = await getAssignment(id, orgId);
  if (!assignment) {
    redirect("/assignments");
  }

  const rows = await listTasks(orgId, id);
  const tasks = rows.map((t) => ({
    taskId: t.taskId,
    status: t.status,
    request: t.request,
    branch: t.branch,
    previewUrl: t.previewUrl,
    prUrl: t.prUrl,
    publishedUrl: t.publishedUrl,
    error: t.error,
    createdAt: t.createdAt ? t.createdAt.toISOString() : null,
  }));

  const config = assignment.config;
  const target = config.publishTarget;
  const canDiscard = hasMinRole(session.user.role as Role, "OPERATOR");
  const canManageSecrets = hasMinRole(session.user.role as Role, "ADMIN");
  const baseUrl = target?.type === "hostinger-ftp" ? target.baseUrl : null;

  return (
    <div className="space-y-24 max-w-7xl mx-auto p-24">
      <Link
        href="/assignments"
        className="inline-flex items-center gap-[4px] text-[10px] font-mono uppercase tracking-wider text-slate hover:text-graphite-ink"
      >
        <ChevronLeft className="size-[14px]" />
        Assignments
      </Link>

      <div className="flex flex-col gap-16 md:flex-row md:items-start md:justify-between">
        <div className="space-y-[4px]">
          <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">{assignment.name}</h1>
          <p className="text-slate text-sm leading-relaxed">
            {roleLabel(assignment.roleKey)} on{" "}
            {isHttpUrl(config.repoUrl) ? (
              <a href={config.repoUrl} target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline">
                {config.repoUrl}
              </a>
            ) : (
              <span className="break-all">{config.repoUrl}</span>
            )}
          </p>
          {canManageSecrets && (
            <div className="pt-[8px]">
              <AssignmentSecrets assignmentId={id} targetType={target?.type ?? ""} />
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-24 gap-y-[6px] text-xs bg-soft-snow border border-mist rounded p-16 shadow-sm min-w-[280px]">
          <dt className="font-mono uppercase tracking-wider text-[10px] text-slate">Status</dt>
          <dd className="text-graphite-ink">{assignment.status}</dd>
          <dt className="font-mono uppercase tracking-wider text-[10px] text-slate">Base branch</dt>
          <dd className="text-graphite-ink">{config.baseBranch || "main"}</dd>
          <dt className="font-mono uppercase tracking-wider text-[10px] text-slate">Site dir</dt>
          <dd className="text-graphite-ink">{config.siteDir || "shared"}</dd>
          <dt className="font-mono uppercase tracking-wider text-[10px] text-slate">Publish</dt>
          <dd className="text-graphite-ink">
            {target?.type === "hostinger-ftp" ? `FTP ${target.host}` : target?.type === "vercel" ? "Vercel" : "n/a"}
          </dd>
          {baseUrl && (
            <>
              <dt className="font-mono uppercase tracking-wider text-[10px] text-slate">Live URL</dt>
              <dd className="text-graphite-ink">
                {isHttpUrl(baseUrl) ? (
                  <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="text-iris-violet hover:underline break-all">
                    {baseUrl}
                  </a>
                ) : (
                  <span className="break-all">{baseUrl}</span>
                )}
              </dd>
            </>
          )}
          <dt className="font-mono uppercase tracking-wider text-[10px] text-slate">Created</dt>
          <dd className="text-graphite-ink">{formatDate(assignment.createdAt?.toISOString())}</dd>
        </dl>
      </div>

      <div className="space-y-[8px]">
        <h2 className="font-lustria text-xl text-graphite-ink">Tasks</h2>
        <AssignmentTasks tasks={tasks} assignmentId={id} userRole={session.user.role} canDiscard={canDiscard} />
      </div>
    </div>
  );
}
