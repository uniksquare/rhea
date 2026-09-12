import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getAssignment, getTask, getTaskUsage, listTaskMessages } from "@/lib/platform";
import { hasMinRole, type Role } from "@/lib/rbac";
import { formatDate } from "@/lib/assignment-ui";
import { TaskChat, type TaskChatMessage } from "@/app/_components/task-chat";
import { TaskUsage } from "@/app/_components/task-usage";
import type { TaskUsageRow } from "@/lib/task-usage";
import { planFromJson } from "@/lib/task-chat";

function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && (value.startsWith("https://") || value.startsWith("http://"));
}

const statusStyles: Record<string, string> = {
  requested: "bg-slate/5 text-slate border-slate/15",
  planning: "bg-iris-violet/5 text-iris-violet border-iris-violet/15",
  previewed: "bg-amber-50 text-amber-700 border-amber-200",
  publishing: "bg-iris-violet/5 text-iris-violet border-iris-violet/15",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  discarded: "bg-slate/5 text-slate border-slate/15 line-through",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const labelCls = "font-mono uppercase tracking-wider text-[10px] text-slate";

function LinkOut({ href, label }: { href: string | null; label: string }) {
  if (!isHttpUrl(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-[4px] text-xs text-iris-violet hover:underline"
    >
      {label}
      <ExternalLink className="size-[12px]" />
    </a>
  );
}

interface TaskPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  const { id, taskId } = await params;
  const orgId = session.user.orgId;

  const assignment = await getAssignment(id, orgId);
  if (!assignment) {
    redirect("/assignments");
  }
  const task = await getTask(taskId, orgId);
  if (!task || task.assignmentId !== assignment.assignmentId) {
    redirect(`/assignments/${id}`);
  }

  const rows = await listTaskMessages(taskId, orgId);
  const messages: TaskChatMessage[] = rows.map((m) => ({
    messageId: m.messageId,
    role: m.role,
    content: m.content,
    mode: m.mode,
    createdAt: m.createdAt ? m.createdAt.toISOString() : null,
  }));

  const usageRows = await getTaskUsage(taskId, orgId);
  const usage: TaskUsageRow[] = usageRows.map((u) => ({
    createdAt: u.createdAt,
    tool: u.tool,
    provider: u.provider,
    model: u.model,
    billing: u.billing === "subscription" ? "subscription" : "api",
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadTokens: u.cacheReadTokens,
    cacheWriteTokens: u.cacheWriteTokens,
    costUsd: Number(u.costUsd),
  }));

  const plan = planFromJson(task.plan);
  const role = session.user.role as Role;
  const canPublish = role === "OWNER" || role === "ADMIN";
  const canDiscard = hasMinRole(role, "OPERATOR");
  const canRequest = hasMinRole(role, "OPERATOR");
  const siteDir = assignment.config.siteDir || "shared";

  return (
    <div className="space-y-24 max-w-5xl mx-auto p-24">
      <Link
        href={`/assignments/${id}`}
        className="inline-flex items-center gap-[4px] text-[10px] font-mono uppercase tracking-wider text-slate hover:text-graphite-ink"
      >
        <ChevronLeft className="size-[14px]" />
        {assignment.name}
      </Link>

      <div className="flex flex-col gap-16 md:flex-row md:items-start md:justify-between">
        <div className="space-y-[8px]">
          <div className="flex items-center gap-[12px]">
            <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Task</h1>
            <span
              className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${
                statusStyles[task.status] ?? statusStyles.requested
              }`}
            >
              {task.status}
            </span>
          </div>
          <p className="text-slate text-sm">
            {assignment.name}
            {task.branch && (
              <>
                {" "}
                on{" "}
                <code className="text-xs font-mono text-slate bg-soft-snow border border-mist rounded px-[6px] py-[2px]">
                  {task.branch}
                </code>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-16">
            <LinkOut href={task.previewUrl} label="Preview" />
            <LinkOut href={task.prUrl} label="PR" />
            <LinkOut href={task.publishedUrl} label="Published" />
          </div>
          {task.error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-[12px] py-[8px]">
              {task.error}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-24 gap-y-[6px] text-xs bg-soft-snow border border-mist rounded p-16 shadow-sm min-w-[240px]">
          <dt className={labelCls}>Site dir</dt>
          <dd className="text-graphite-ink">{siteDir}</dd>
          <dt className={labelCls}>Session</dt>
          <dd className="text-graphite-ink">{task.sessionId ? "resumable" : "not started"}</dd>
          <dt className={labelCls}>Created</dt>
          <dd className="text-graphite-ink">{formatDate(task.createdAt?.toISOString())}</dd>
          <dt className={labelCls}>Updated</dt>
          <dd className="text-graphite-ink">{formatDate(task.updatedAt?.toISOString())}</dd>
        </dl>
      </div>

      <section className="space-y-[8px]">
        <h2 className={labelCls}>Original request</h2>
        <div className="border border-mist rounded bg-paper-white shadow-sm p-16">
          <p className="text-sm text-graphite-ink whitespace-pre-wrap">{task.request}</p>
        </div>
      </section>

      {plan && (
        <section className="space-y-[8px]">
          <h2 className={labelCls}>Plan</h2>
          <div className="border border-mist rounded bg-paper-white shadow-sm p-16 space-y-16">
            {plan.summary && <p className="text-sm text-graphite-ink whitespace-pre-wrap">{plan.summary}</p>}
            {plan.edits.length > 0 && (
              <div className="space-y-[6px]">
                <h3 className={labelCls}>Edits</h3>
                <ul className="space-y-[6px]">
                  {plan.edits.map((e, i) => (
                    <li key={i} className="text-sm text-graphite-ink">
                      <code className="text-xs font-mono text-slate bg-soft-snow border border-mist rounded px-[6px] py-[2px] mr-[8px]">
                        {e.file || "(file)"}
                      </code>
                      {e.change}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.questions.length > 0 && (
              <div className="space-y-[6px]">
                <h3 className={labelCls}>Questions for you</h3>
                <ul className="list-disc pl-[20px] space-y-[4px]">
                  {plan.questions.map((q, i) => (
                    <li key={i} className="text-sm text-amber-700">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-[8px]">
        <h2 className={labelCls}>Conversation</h2>
        <TaskChat
          taskId={taskId}
          status={task.status}
          branch={task.branch}
          messages={messages}
          canRequest={canRequest}
          canPublish={canPublish}
          canDiscard={canDiscard}
        />
      </section>

      <section className="space-y-[8px]">
        <h2 className={labelCls}>Usage</h2>
        <TaskUsage rows={usage} />
      </section>
    </div>
  );
}
