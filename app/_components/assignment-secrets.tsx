"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AssignmentSecretsProps {
  assignmentId: string;
  targetType: "hostinger-ftp" | "vercel" | string;
}

const labelCls = "text-[10px] font-mono font-medium text-slate uppercase tracking-wider";
const inputCls =
  "bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden";
const primaryBtn =
  "bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtn =
  "border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none";

/** "Rotate credentials" dialog for an assignment's encrypted secrets. Fields
 *  shown depend on the assignment's publish target: an FTP password for
 *  hostinger-ftp, a Vercel token for vercel. Inputs are never prefilled. */
export function AssignmentSecrets({ assignmentId, targetType }: AssignmentSecretsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishPass, setPublishPass] = useState("");
  const [vercelToken, setVercelToken] = useState("");

  const reset = () => {
    setPublishPass("");
    setVercelToken("");
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const body: Record<string, string> =
      targetType === "hostinger-ftp" ? { publishPass } : targetType === "vercel" ? { vercelToken } : {};

    if (Object.values(body).every((v) => !v)) {
      setError("Enter a new value to rotate");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/secrets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setPublishPass("");
      setVercelToken("");
      setSuccess("Credentials rotated.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to rotate credentials");
    } finally {
      setSubmitting(false);
    }
  };

  if (targetType !== "hostinger-ftp" && targetType !== "vercel") {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className={secondaryBtn}>
          <KeyRound className="size-[14px] inline-block mr-[6px]" />
          Rotate credentials
        </button>
      </DialogTrigger>
      <DialogContent className="bg-paper-white border border-mist text-graphite-ink rounded-lg shadow-lg max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-lustria text-xl text-graphite-ink">Rotate credentials</DialogTitle>
            <DialogDescription className="text-slate text-sm">
              The new value is encrypted at rest and replaces the current one. Leave blank to keep it unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-16 py-16">
            {targetType === "hostinger-ftp" && (
              <div className="space-y-[4px]">
                <label className={labelCls}>FTP password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  value={publishPass}
                  onChange={(e) => setPublishPass(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            {targetType === "vercel" && (
              <div className="space-y-[4px]">
                <label className={labelCls}>Vercel token</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New token"
                  value={vercelToken}
                  onChange={(e) => setVercelToken(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-[12px] py-[8px]">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-[12px] py-[8px]">
                {success}
              </p>
            )}
          </div>

          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
              Close
            </button>
            <button type="submit" disabled={submitting} className={primaryBtn}>
              {submitting ? (
                <>
                  <Loader2 className="size-[14px] animate-spin" />
                  Rotating...
                </>
              ) : (
                "Rotate"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
