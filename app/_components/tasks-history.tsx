"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { groupTasksByStatus, filterTasks } from "@/lib/task-history";

export interface TaskHistoryRow {
  taskId: string;
  assignmentId: string;
  assignmentName: string;
  status: string;
  request: string;
  branch: string | null;
  previewUrl: string | null;
  prUrl: string | null;
  publishedUrl: string | null;
  error: string | null;
  createdAt: string | null;
}

export interface TaskHistoryAssignment {
  assignmentId: string;
  name: string;
}

interface TasksHistoryProps {
  tasks: TaskHistoryRow[];
  assignments: TaskHistoryAssignment[];
  /** May revive a discarded task (role >= OPERATOR, tasks:request). */
  canRevive: boolean;
  /** May discard a task, subject to the same status gating as elsewhere (tasks:discard). */
  canDiscard: boolean;
}

type PendingAction = { kind: "revive" | "discard"; task: TaskHistoryRow } | null;

const statusStyles: Record<string, string> = {
  requested: "bg-slate/5 text-slate border-slate/15",
  working: "bg-iris-violet/5 text-iris-violet border-iris-violet/15",
  planning: "bg-iris-violet/5 text-iris-violet border-iris-violet/15",
  previewed: "bg-amber-50 text-amber-700 border-amber-200",
  publishing: "bg-iris-violet/5 text-iris-violet border-iris-violet/15",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  discarded: "bg-slate/5 text-slate border-slate/15 line-through",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const primaryBtn =
  "bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtn =
  "border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none";
const rowBtn =
  "inline-flex items-center gap-[6px] px-[10px] py-[6px] rounded border font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
const inputCls =
  "bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-sm";
const selectCls =
  "bg-paper-white border border-mist text-graphite-ink text-sm rounded px-[12px] py-[8px] focus:border-slate/40 focus:outline-hidden cursor-pointer";
const chipCls =
  "px-[10px] py-[6px] rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer select-none";

function truncate(text: string, max = 96) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function formatAge(value: string | null): string {
  if (!value) return "n/a";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "n/a";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LinkOut({ href, label }: { href: string | null; label: string }) {
  if (!href || !isHttpUrl(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-[4px] text-xs text-iris-violet hover:underline"
    >
      {label}
      <ExternalLink className="size-[12px]" />
    </a>
  );
}

export function TasksHistory({ tasks, assignments, canRevive, canDiscard }: TasksHistoryProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<string>("");
  const [query, setQuery] = useState("");

  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    return groupTasksByStatus(tasks)
      .filter((g) => g.tasks.length > 0)
      .map((g) => ({ status: g.status, count: g.tasks.length }));
  }, [tasks]);

  const filtered = useMemo(
    () =>
      filterTasks(tasks, {
        status: statusFilter ?? undefined,
        assignmentId: assignmentFilter || undefined,
        q: query,
      }),
    [tasks, statusFilter, assignmentFilter, query]
  );

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${pending.task.taskId}/${pending.kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setPending(null);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="space-y-16">
        <div className="flex flex-wrap items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`${chipCls} ${
              statusFilter === null
                ? "bg-iris-violet/10 border-iris-violet/30 text-iris-violet"
                : "bg-paper-white border-mist text-slate hover:border-iris-violet/30"
            }`}
          >
            All ({tasks.length})
          </button>
          {statusCounts.map(({ status, count }) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={`${chipCls} ${
                statusFilter === status
                  ? "bg-iris-violet/10 border-iris-violet/30 text-iris-violet"
                  : "bg-paper-white border-mist text-slate hover:border-iris-violet/30"
              }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-[12px]">
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className={selectCls}
          >
            <option value="">All assignments</option>
            {assignments.map((a) => (
              <option key={a.assignmentId} value={a.assignmentId}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests..."
            className={`${inputCls} flex-1 min-w-[220px]`}
          />
        </div>
      </div>

      <div className="border border-mist rounded overflow-hidden bg-paper-white shadow-sm mt-16">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-mist bg-soft-snow text-[10px] font-mono font-medium text-slate uppercase tracking-wider">
                <th className="py-16 px-24">Status</th>
                <th className="py-16 px-24">Assignment</th>
                <th className="py-16 px-24">Request</th>
                <th className="py-16 px-24">Branch</th>
                <th className="py-16 px-24">Age</th>
                <th className="py-16 px-24">Links</th>
                <th className="py-16 px-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-48 text-center text-slate text-sm">
                    {tasks.length === 0
                      ? "No tasks yet. Tasks appear here once rhea picks up a request."
                      : "No tasks match these filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const isDiscarded = t.status === "discarded";
                  const isTerminal = t.status === "published" || t.status === "discarded";
                  const isPublishing = t.status === "publishing";
                  return (
                    <tr key={t.taskId} className="hover:bg-soft-snow/50 transition-colors align-top">
                      <td className="py-16 px-24">
                        <span
                          className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${
                            statusStyles[t.status] ?? statusStyles.requested
                          }`}
                        >
                          {isPublishing ? "publishing…" : t.status}
                        </span>
                      </td>
                      <td className="py-16 px-24 text-sm text-graphite-ink" title={t.assignmentName}>
                        {t.assignmentName}
                      </td>
                      <td className="py-16 px-24 max-w-md">
                        <span className="text-sm text-graphite-ink" title={t.request}>
                          {truncate(t.request)}
                        </span>
                        {t.error && (
                          <p className="mt-[4px] text-xs text-rose-700" title={t.error}>
                            {truncate(t.error, 120)}
                          </p>
                        )}
                      </td>
                      <td className="py-16 px-24">
                        {t.branch ? (
                          <code className="text-xs font-mono text-slate bg-soft-snow border border-mist rounded px-[6px] py-[2px]">
                            {t.branch}
                          </code>
                        ) : (
                          <span className="text-fog text-xs">n/a</span>
                        )}
                      </td>
                      <td className="py-16 px-24 text-xs text-slate whitespace-nowrap">{formatAge(t.createdAt)}</td>
                      <td className="py-16 px-24">
                        <div className="flex flex-col gap-[4px]">
                          <Link
                            href={`/assignments/${t.assignmentId}/tasks/${t.taskId}`}
                            className="inline-flex items-center gap-[4px] text-xs text-iris-violet hover:underline"
                          >
                            <MessageSquare className="size-[12px]" />
                            Open
                          </Link>
                          <LinkOut href={t.previewUrl} label="Preview" />
                          <LinkOut href={t.prUrl} label="PR" />
                          <LinkOut href={t.publishedUrl} label="Published" />
                        </div>
                      </td>
                      <td className="py-16 px-24 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-[8px]">
                          {canRevive && (
                            <button
                              type="button"
                              disabled={!isDiscarded}
                              onClick={() => setPending({ kind: "revive", task: t })}
                              className={`${rowBtn} bg-iris-violet/5 border-iris-violet/30 text-iris-violet hover:bg-iris-violet/10`}
                              title={isDiscarded ? "Revive this task" : "Only discarded tasks can be revived"}
                            >
                              <RotateCcw className="size-[12px]" />
                              Revive
                            </button>
                          )}
                          {canDiscard && (
                            <button
                              type="button"
                              disabled={isTerminal || isPublishing}
                              onClick={() => setPending({ kind: "discard", task: t })}
                              className={`${rowBtn} bg-paper-white border-mist text-slate hover:text-rose-700 hover:border-rose-200`}
                              title={
                                isPublishing
                                  ? "Task is currently being published"
                                  : isTerminal
                                    ? "Published or discarded tasks cannot be discarded"
                                    : "Discard this task"
                              }
                            >
                              <Trash2 className="size-[12px]" />
                              Discard
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setPending(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="bg-paper-white border border-mist text-graphite-ink rounded-lg shadow-lg max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="font-lustria text-xl text-graphite-ink">
              {pending?.kind === "revive" ? "Revive this task?" : "Discard task?"}
            </DialogTitle>
            <DialogDescription className="text-slate text-sm">
              {pending?.kind === "revive"
                ? "The task moves back to planning and its worktree is re-created from its branch."
                : "The task is marked discarded. Its branch and preview are left in place; nothing is deleted."}
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="py-8 space-y-[6px]">
              <p className="text-sm text-graphite-ink">{truncate(pending.task.request, 160)}</p>
              {pending.task.branch && <code className="text-xs font-mono text-slate">{pending.task.branch}</code>}
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-[12px] py-[8px]">{error}</p>
          )}

          <DialogFooter>
            <button type="button" disabled={busy} onClick={() => setPending(null)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={confirm} className={primaryBtn}>
              {busy ? (
                <>
                  <Loader2 className="size-[14px] animate-spin" />
                  {pending?.kind === "revive" ? "Reviving..." : "Discarding..."}
                </>
              ) : pending?.kind === "revive" ? (
                "Revive"
              ) : (
                "Discard"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
