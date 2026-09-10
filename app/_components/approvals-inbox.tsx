"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Rocket, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roleLabel } from "./assignments-list";
import type { ApprovalGroup } from "@/lib/approvals";

interface ApprovalsInboxProps {
  groups: ApprovalGroup[];
  canPublish: boolean;
  canDiscard: boolean;
}

type PendingAction = {
  kind: "publish" | "discard";
  taskId: string;
  request: string;
  branch: string | null;
} | null;

const primaryBtn =
  "bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtn =
  "border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none";
const rowBtn =
  "inline-flex items-center gap-[6px] px-[10px] py-[6px] rounded border font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

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

function PreviewLink({ href }: { href: string | null }) {
  if (!href || !isHttpUrl(href)) {
    return <span className="text-fog text-xs">no preview</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-[4px] text-xs text-iris-violet hover:underline"
    >
      Preview
      <ExternalLink className="size-[12px]" />
    </a>
  );
}

export function ApprovalsInbox({ groups, canPublish, canDiscard }: ApprovalsInboxProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${pending.taskId}/${pending.kind}`, { method: "POST" });
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
      <div className="space-y-24">
        {groups.map((group) => (
          <div
            key={group.assignment.assignmentId}
            className="border border-mist rounded overflow-hidden bg-paper-white shadow-sm"
          >
            <div className="px-24 py-16 border-b border-mist bg-soft-snow flex items-center justify-between gap-16">
              <div className="min-w-0 space-y-[2px]">
                <h3 className="font-lustria text-base text-graphite-ink truncate">{group.assignment.name}</h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate">
                  {roleLabel(group.assignment.roleKey)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-slate">
                {group.tasks.length} pending
              </span>
            </div>

            <div className="divide-y divide-mist">
              {group.tasks.map((task) => (
                <div
                  key={task.taskId}
                  className="px-24 py-16 flex flex-col md:flex-row md:items-center gap-16 justify-between"
                >
                  <div className="min-w-0 space-y-[6px]">
                    <p className="text-sm text-graphite-ink" title={task.request}>
                      {truncate(task.request)}
                    </p>
                    <div className="flex flex-wrap items-center gap-[12px] text-xs text-slate">
                      {task.branch ? (
                        <code className="font-mono text-xs text-slate bg-soft-snow border border-mist rounded px-[6px] py-[2px]">
                          {task.branch}
                        </code>
                      ) : (
                        <span className="text-fog">no branch</span>
                      )}
                      <PreviewLink href={task.previewUrl} />
                      <span>{formatAge(task.createdAt)}</span>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-[8px] shrink-0">
                    <button
                      type="button"
                      disabled={!canPublish}
                      onClick={() =>
                        setPending({ kind: "publish", taskId: task.taskId, request: task.request, branch: task.branch })
                      }
                      className={`${rowBtn} bg-iris-violet/5 border-iris-violet/30 text-iris-violet hover:bg-iris-violet/10`}
                      title={canPublish ? "Publish this task live" : "You do not have permission to publish"}
                    >
                      <Rocket className="size-[12px]" />
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={!canDiscard}
                      onClick={() =>
                        setPending({ kind: "discard", taskId: task.taskId, request: task.request, branch: task.branch })
                      }
                      className={`${rowBtn} bg-paper-white border-mist text-slate hover:text-rose-700 hover:border-rose-200`}
                      title={canDiscard ? "Discard this task" : "You do not have permission to discard"}
                    >
                      <Trash2 className="size-[12px]" />
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
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
              {pending?.kind === "publish" ? "Publish task live?" : "Discard task?"}
            </DialogTitle>
            <DialogDescription className="text-slate text-sm">
              {pending?.kind === "publish"
                ? "This pushes the previewed branch to the live site. Visitors will see the change immediately."
                : "The task is marked discarded. Its branch and preview are left in place; nothing is deleted."}
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="py-8 space-y-[6px]">
              <p className="text-sm text-graphite-ink">{truncate(pending.request, 160)}</p>
              {pending.branch && <code className="text-xs font-mono text-slate">{pending.branch}</code>}
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
                  {pending?.kind === "publish" ? "Publishing..." : "Discarding..."}
                </>
              ) : pending?.kind === "publish" ? (
                "Publish"
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
