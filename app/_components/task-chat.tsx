"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Hammer, ListChecks, Loader2, Rocket, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "./assignments-list";

export interface TaskChatMessage {
  messageId: string;
  role: string;
  content: string;
  mode: string | null;
  createdAt: string | null;
}

interface TaskChatProps {
  taskId: string;
  status: string;
  branch: string | null;
  messages: TaskChatMessage[];
  canRequest: boolean;
  canPublish: boolean;
  canDiscard: boolean;
}

type Mode = "plan" | "edit";
type Busy = { kind: Mode | "preview" | "publish" | "discard"; text?: string } | null;
type PendingAction = "publish" | "discard" | null;

const MESSAGE_MAX = 20000;
const LOCKED = new Set(["published", "discarded", "publishing", "working"]);

const primaryBtn =
  "bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtn =
  "border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none flex items-center gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed";
const dangerBtn =
  "border border-mist bg-paper-white hover:border-rose-200 hover:text-rose-700 text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none flex items-center gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed";
const textareaCls =
  "w-full min-h-[96px] bg-paper-white border border-mist text-graphite-ink text-sm rounded px-[12px] py-[8px] focus:border-slate/40 focus:outline-hidden resize-y disabled:opacity-60";

function bubbleCls(role: string) {
  if (role === "user") return "bg-iris-violet/5 border-iris-violet/15 ml-auto";
  if (role === "system") return "bg-soft-snow border-mist italic";
  return "bg-paper-white border-mist mr-auto";
}

function roleLabel(role: string) {
  if (role === "user") return "You";
  if (role === "assistant") return "rhea";
  return "System";
}

export function TaskChat({
  taskId,
  status,
  branch,
  messages,
  canRequest,
  canPublish,
  canDiscard,
}: TaskChatProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const locked = LOCKED.has(status);
  const isPreviewed = status === "previewed";
  const canSend = canRequest && !locked && text.trim().length > 0 && text.length <= MESSAGE_MAX;
  const canPreview =
    canRequest && !!branch && (status === "planning" || status === "previewed") && !busy;
  const canDiscardNow = canDiscard && !locked && !busy;

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(`/api/tasks/${taskId}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  };

  const send = async (mode: Mode) => {
    if (!canSend || busy) return;
    const message = text.trim();
    setBusy({ kind: mode, text: message });
    setError(null);
    try {
      await post("message", { message, mode });
      setText("");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Request failed");
      // The turn (and its error) is recorded server-side; refresh to show it.
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const preview = async () => {
    if (!canPreview) return;
    setBusy({ kind: "preview" });
    setError(null);
    try {
      await post("preview");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Preview failed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const confirmPending = async () => {
    if (!pending || busy) return;
    setBusy({ kind: pending });
    setError(null);
    try {
      await post(pending);
      setPending(null);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const running = busy?.kind === "plan" || busy?.kind === "edit";

  return (
    <div className="space-y-16">
      <div className="border border-mist rounded bg-soft-snow/50 shadow-sm p-16 space-y-[12px]">
        {messages.length === 0 && !running ? (
          <p className="text-sm text-slate text-center py-24">
            No messages yet. Ask rhea for a plan, or tell it to make the change.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.messageId} className={`max-w-[85%] border rounded p-12 space-y-[4px] ${bubbleCls(m.role)}`}>
              <div className="flex items-center gap-[8px] text-[10px] font-mono uppercase tracking-wider text-slate">
                <span>{roleLabel(m.role)}</span>
                {m.mode && <span className="text-fog">{m.mode}</span>}
                <span className="text-fog ml-auto">{formatDate(m.createdAt)}</span>
              </div>
              <p className="text-sm text-graphite-ink whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          ))
        )}
        {running && (
          <>
            <div className={`max-w-[85%] border rounded p-12 space-y-[4px] ${bubbleCls("user")}`}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate">You</div>
              <p className="text-sm text-graphite-ink whitespace-pre-wrap break-words">{busy?.text}</p>
            </div>
            <div className={`max-w-[85%] border rounded p-12 flex items-center gap-[8px] ${bubbleCls("assistant")}`}>
              <Loader2 className="size-[14px] animate-spin text-iris-violet" />
              <span className="text-sm text-slate">
                rhea is {busy?.kind === "plan" ? "reading the site and drafting a plan" : "making the change"}. This can
                take a minute.
              </span>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-[12px] py-[8px]">{error}</p>
      )}

      {locked ? (
        <p className="text-xs text-slate">This task is {status}; it no longer accepts messages.</p>
      ) : canRequest ? (
        <div className="space-y-[12px]">
          <textarea
            className={textareaCls}
            placeholder="Describe the change, answer a question from the plan, or ask for an adjustment..."
            value={text}
            maxLength={MESSAGE_MAX}
            disabled={!!busy}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-[8px]">
            <button type="button" className={secondaryBtn} disabled={!canSend || !!busy} onClick={() => send("plan")}>
              {busy?.kind === "plan" ? <Loader2 className="size-[14px] animate-spin" /> : <ListChecks className="size-[14px]" />}
              Ask for a plan
            </button>
            <button type="button" className={primaryBtn} disabled={!canSend || !!busy} onClick={() => send("edit")}>
              {busy?.kind === "edit" ? <Loader2 className="size-[14px] animate-spin" /> : <Hammer className="size-[14px]" />}
              Make the change
            </button>
            <span className="flex-1" />
            <button
              type="button"
              className={secondaryBtn}
              disabled={!canPreview}
              onClick={preview}
              title={branch ? "Deploy a preview of this task's branch" : "Make a change first to get a branch"}
            >
              {busy?.kind === "preview" ? <Loader2 className="size-[14px] animate-spin" /> : <Eye className="size-[14px]" />}
              Build preview
            </button>
            {canPublish && (
              <button
                type="button"
                className={primaryBtn}
                disabled={!isPreviewed || !!busy}
                onClick={() => setPending("publish")}
                title={isPreviewed ? "Publish this task live" : "Only previewed tasks can be published"}
              >
                <Rocket className="size-[14px]" />
                Publish
              </button>
            )}
            {canDiscard && (
              <button type="button" className={dangerBtn} disabled={!canDiscardNow} onClick={() => setPending("discard")}>
                <Trash2 className="size-[14px]" />
                Discard
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate">Your role can view this task but not send messages.</p>
      )}

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
              {pending === "publish" ? "Publish task live?" : "Discard task?"}
            </DialogTitle>
            <DialogDescription className="text-slate text-sm">
              {pending === "publish"
                ? "This pushes the previewed branch to the live site. Visitors will see the change immediately."
                : "The task is marked discarded. Its branch and preview are left in place; nothing is deleted."}
            </DialogDescription>
          </DialogHeader>
          {branch && (
            <div className="py-8">
              <code className="text-xs font-mono text-slate">{branch}</code>
            </div>
          )}
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-[12px] py-[8px]">{error}</p>
          )}
          <DialogFooter>
            <button type="button" disabled={!!busy} onClick={() => setPending(null)} className={secondaryBtn}>
              Cancel
            </button>
            <button type="button" disabled={!!busy} onClick={confirmPending} className={primaryBtn}>
              {busy?.kind === "publish" || busy?.kind === "discard" ? (
                <>
                  <Loader2 className="size-[14px] animate-spin" />
                  {pending === "publish" ? "Publishing..." : "Discarding..."}
                </>
              ) : pending === "publish" ? (
                "Publish"
              ) : (
                "Discard"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
