"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ChevronRight } from "lucide-react";
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

export interface AssignmentRow {
  assignmentId: string;
  name: string;
  roleKey: string;
  status: string;
  createdAt: string | null;
}

interface AssignmentsListProps {
  initialAssignments: AssignmentRow[];
  userRole?: string;
}

import { ROLE_OPTIONS, roleLabel, formatDate } from "@/lib/assignment-ui";
export { roleLabel, formatDate };

const labelCls = "text-[10px] font-mono font-medium text-slate uppercase tracking-wider";
const inputCls =
  "bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden";
const selectCls =
  "w-full bg-paper-white border border-mist text-graphite-ink text-sm rounded px-[12px] py-[8px] focus:border-slate/40 focus:outline-hidden cursor-pointer";
const primaryBtn =
  "bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtn =
  "border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none";

export function AssignmentsList({ initialAssignments, userRole }: AssignmentsListProps) {
  const router = useRouter();
  const canCreate = userRole === "OWNER" || userRole === "ADMIN";

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [roleKey, setRoleKey] = useState("web-developer");
  const [repoUrl, setRepoUrl] = useState("");
  const [workspacePath, setWorkspacePath] = useState("");
  const [siteDir, setSiteDir] = useState("shared");
  const [baseBranch, setBaseBranch] = useState("main");
  const [targetType, setTargetType] = useState<"hostinger-ftp" | "vercel">("hostinger-ftp");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("21");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [remoteDir, setRemoteDir] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [projectId, setProjectId] = useState("");

  const reset = () => {
    setName("");
    setRoleKey("web-developer");
    setRepoUrl("");
    setWorkspacePath("");
    setSiteDir("shared");
    setBaseBranch("main");
    setTargetType("hostinger-ftp");
    setHost("");
    setPort("21");
    setUser("");
    setPass("");
    setRemoteDir("");
    setBaseUrl("");
    setProjectId("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const publishTarget =
      targetType === "hostinger-ftp"
        ? {
            type: "hostinger-ftp",
            host,
            port: port ? Number(port) : undefined,
            user,
            remoteDir,
            baseUrl,
          }
        : { type: "vercel", projectId: projectId || undefined };

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          roleKey,
          config: { repoUrl, workspacePath, siteDir, baseBranch, publishTarget },
          secrets: targetType === "hostinger-ftp" && pass ? { pass } : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to create assignment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-16">
      <div className="flex items-center justify-between bg-soft-snow p-16 rounded border border-mist shadow-sm">
        <span className="text-xs text-slate">
          {initialAssignments.length} assignment{initialAssignments.length === 1 ? "" : "s"}
        </span>
        {canCreate && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setError(null);
            }}
          >
            <DialogTrigger asChild>
              <button className={primaryBtn}>
                <Plus className="size-[14px]" />
                New assignment
              </button>
            </DialogTrigger>
            <DialogContent className="bg-paper-white border border-mist text-graphite-ink rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle className="font-lustria text-xl text-graphite-ink">New assignment</DialogTitle>
                  <DialogDescription className="text-slate text-sm">
                    Put rhea in a role for one repo. Credentials are encrypted at rest.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-16 py-16">
                  <div className="grid grid-cols-2 gap-[12px]">
                    <div className="space-y-[4px]">
                      <label className={labelCls}>Name</label>
                      <Input required placeholder="Yoga Essence site" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-[4px]">
                      <label className={labelCls}>Role</label>
                      <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={selectCls}>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-[4px]">
                    <label className={labelCls}>Repo URL</label>
                    <Input required placeholder="https://github.com/org/repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-[4px]">
                    <label className={labelCls}>Workspace path</label>
                    <Input required placeholder="/srv/workspaces/repo" value={workspacePath} onChange={(e) => setWorkspacePath(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <div className="space-y-[4px]">
                      <label className={labelCls}>Site dir</label>
                      <Input placeholder="shared" value={siteDir} onChange={(e) => setSiteDir(e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-[4px]">
                      <label className={labelCls}>Base branch</label>
                      <Input placeholder="main" value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <div className="space-y-[4px]">
                    <label className={labelCls}>Publish target</label>
                    <select value={targetType} onChange={(e) => setTargetType(e.target.value as "hostinger-ftp" | "vercel")} className={selectCls}>
                      <option value="hostinger-ftp">Hostinger FTP</option>
                      <option value="vercel">Vercel</option>
                    </select>
                  </div>

                  {targetType === "hostinger-ftp" ? (
                    <div className="space-y-[12px] border border-mist rounded p-12 bg-soft-snow/50">
                      <div className="grid grid-cols-3 gap-[12px]">
                        <div className="col-span-2 space-y-[4px]">
                          <label className={labelCls}>Host</label>
                          <Input required placeholder="ftp.example.com" value={host} onChange={(e) => setHost(e.target.value)} className={inputCls} />
                        </div>
                        <div className="space-y-[4px]">
                          <label className={labelCls}>Port</label>
                          <Input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-[12px]">
                        <div className="space-y-[4px]">
                          <label className={labelCls}>User</label>
                          <Input required autoComplete="off" value={user} onChange={(e) => setUser(e.target.value)} className={inputCls} />
                        </div>
                        <div className="space-y-[4px]">
                          <label className={labelCls}>Password</label>
                          <Input required type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className={inputCls} />
                        </div>
                      </div>
                      <div className="space-y-[4px]">
                        <label className={labelCls}>Remote dir</label>
                        <Input required placeholder="/public_html/shared" value={remoteDir} onChange={(e) => setRemoteDir(e.target.value)} className={inputCls} />
                      </div>
                      <div className="space-y-[4px]">
                        <label className={labelCls}>Base URL</label>
                        <Input required placeholder="https://example.com/shared" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-[4px] border border-mist rounded p-12 bg-soft-snow/50">
                      <label className={labelCls}>Vercel project ID (optional)</label>
                      <Input placeholder="prj_..." value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} />
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-[12px] py-[8px]">{error}</p>
                  )}
                </div>

                <DialogFooter>
                  <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className={primaryBtn}>
                    {submitting ? (
                      <>
                        <Loader2 className="size-[14px] animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create assignment"
                    )}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border border-mist rounded overflow-hidden bg-paper-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-mist bg-soft-snow text-[10px] font-mono font-medium text-slate uppercase tracking-wider">
                <th className="py-16 px-24">Name</th>
                <th className="py-16 px-24">Role</th>
                <th className="py-16 px-24 text-center">Status</th>
                <th className="py-16 px-24">Created</th>
                <th className="py-16 px-24 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {initialAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-48 text-center text-slate text-sm">
                    No assignments yet.{canCreate ? " Create one to get started." : ""}
                  </td>
                </tr>
              ) : (
                initialAssignments.map((a) => (
                  <tr
                    key={a.assignmentId}
                    className="hover:bg-soft-snow/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/assignments/${a.assignmentId}`)}
                  >
                    <td className="py-16 px-24">
                      <span className="font-semibold text-sm text-graphite-ink group-hover:text-iris-violet transition-colors">
                        {a.name}
                      </span>
                    </td>
                    <td className="py-16 px-24 text-sm text-graphite-ink">{roleLabel(a.roleKey)}</td>
                    <td className="py-16 px-24 text-center">
                      <span
                        className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${
                          a.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate/5 text-slate border-slate/15"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-16 px-24 text-xs text-slate">{formatDate(a.createdAt)}</td>
                    <td className="py-16 px-24 text-right">
                      <ChevronRight className="size-[16px] text-fog group-hover:text-iris-violet inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
