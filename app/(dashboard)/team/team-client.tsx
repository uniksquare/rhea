"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Key, 
  Trash2, 
  Clipboard, 
  Check, 
  Loader2, 
  Shield, 
  Plus,
  Users,
  Copy,
  AlertTriangle,
  UserX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Member {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
}

interface ApiKey {
  key_id: string;
  key_prefix: string;
  label: string;
  scopes: string[] | any;
  expires_at: string | null;
  created_at: string;
}

interface TeamClientProps {
  initialMembers: Member[];
  initialApiKeys: ApiKey[];
  currentUser: {
    id?: string;
    email?: string | null;
    role?: string;
    orgId?: string;
  };
}

export function TeamClient({ initialMembers, initialApiKeys, currentUser }: TeamClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);

  // States
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  // API Key creation
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [keyExpires, setKeyExpires] = useState("30");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "incidents:read",
    "agent:execute"
  ]);

  // Display raw key once
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdminOrOwner = currentUser.role === "ADMIN" || currentUser.role === "OWNER";
  const isOwner = currentUser.role === "OWNER";

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingMemberId(userId);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        throw new Error("Failed to update role");
      }

      const updated = await res.json();
      setMembers(members.map(m => m.user_id === userId ? { ...m, role: updated.role } : m));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error updating role.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setDeletingMemberId(userId);
    try {
      const res = await fetch(`/api/team?userId=${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove member");
      }

      setMembers(members.filter(m => m.user_id !== userId));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error removing member.");
    } finally {
      setDeletingMemberId(null);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim() || isCreatingKey) return;

    setIsCreatingKey(true);
    try {
      const res = await fetch("/api/team/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: keyLabel,
          scopes: selectedScopes,
          expiresDays: keyExpires === "never" ? null : parseInt(keyExpires),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate API Key");
      }

      const data = await res.json();
      setGeneratedKey(data.rawKey);
      
      // Append to local list
      const newKey: ApiKey = {
        key_id: data.key_id,
        key_prefix: data.key_prefix,
        label: data.label,
        scopes: data.scopes,
        expires_at: data.expires_at,
        created_at: data.created_at,
      };
      setApiKeys([newKey, ...apiKeys]);
      
      // Reset form
      setKeyLabel("");
      setIsCreateKeyOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to generate API Key.");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    setRevokingKeyId(keyId);
    try {
      const res = await fetch(`/api/team/api-keys?keyId=${keyId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to revoke API key");
      }

      setApiKeys(apiKeys.filter(k => k.key_id !== keyId));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error revoking API key.");
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const availableScopes = [
    { value: "incidents:read", label: "Read Incidents", desc: "Allows retrieving incidents list and detail" },
    { value: "incidents:write", label: "Write Incidents", desc: "Allows creating or resolving incidents" },
    { value: "agent:execute", label: "Run Agent Operations", desc: "Allows triggering Rhea AI investigations" },
  ];

  const handleToggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* 1. Team Management Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-sm p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Team Members</h2>
          </div>
          <Badge className="bg-zinc-850 border-zinc-700 text-zinc-400">
            {members.length} {members.length === 1 ? "member" : "members"}
          </Badge>
        </div>

        <div className="space-y-4 divide-y divide-zinc-850">
          {members.map((member) => {
            const isSelf = member.email === currentUser.email;
            const isTargetOwner = member.role === "OWNER";
            const canManage = isAdminOrOwner && !isTargetOwner && !isSelf;

            return (
              <div key={member.user_id} className="flex items-center justify-between pt-4 first:pt-0">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar_url ? (
                    <img 
                      src={member.avatar_url} 
                      alt={member.name || "User Avatar"} 
                      className="size-10 rounded-full border border-zinc-800"
                    />
                  ) : (
                    <div className="size-10 rounded-full border border-zinc-800 bg-zinc-850 flex items-center justify-center font-bold text-zinc-300 text-sm">
                      {(member.name || member.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {member.name || "Pending User"}
                      {isSelf && <span className="text-xs text-purple-400 font-bold ml-1.5">(You)</span>}
                    </span>
                    <span className="text-xs text-zinc-500 truncate">{member.email}</span>
                  </div>
                </div>

                {/* Role Switcher or Badge */}
                <div className="flex items-center gap-3">
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <select
                        disabled={updatingMemberId === member.user_id}
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-md text-zinc-300 text-xs font-semibold px-2 py-1 focus:outline-hidden cursor-pointer"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="OPERATOR">Operator</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      {updatingMemberId === member.user_id && <Loader2 className="size-3 animate-spin text-zinc-500" />}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {member.role}
                    </span>
                  )}

                  {/* Remove Button */}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={deletingMemberId === member.user_id}
                      className="hover:bg-red-500/10 hover:text-red-400 p-2 text-zinc-500"
                    >
                      {deletingMemberId === member.user_id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserX className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. API Keys Management Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-sm p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="size-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">API Keys</h2>
          </div>
          {isAdminOrOwner && (
            <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white size-sm gap-1">
                  <Plus className="size-4" />
                  Generate Key
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <form onSubmit={handleCreateApiKey}>
                  <DialogHeader>
                    <DialogTitle className="text-white text-xl">Generate Programmatic API Key</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      Create an API key for Slack webhooks, CLI integration, or CI/CD pipelines.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Key Label</label>
                      <Input
                        required
                        placeholder="e.g. Jenkins CI/CD Pipeline"
                        value={keyLabel}
                        onChange={(e) => setKeyLabel(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-zinc-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Scopes / Permissions</label>
                      <div className="space-y-2">
                        {availableScopes.map((scope) => (
                          <div 
                            key={scope.value}
                            onClick={() => handleToggleScope(scope.value)}
                            className={`flex items-start gap-3 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                              selectedScopes.includes(scope.value)
                                ? "bg-purple-950/10 border-purple-800/40 text-zinc-200"
                                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800/40"
                            }`}
                          >
                            <input 
                              type="checkbox"
                              checked={selectedScopes.includes(scope.value)}
                              readOnly
                              className="mt-1 size-3.5 accent-purple-500 rounded border-zinc-700 bg-zinc-900 focus:ring-0"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs font-semibold text-zinc-200">{scope.label}</span>
                              <p className="text-[10px] text-zinc-500 leading-snug">{scope.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Expiration</label>
                      <select
                        value={keyExpires}
                        onChange={(e) => setKeyExpires(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs font-semibold px-3 py-2.5 focus:border-zinc-750"
                      >
                        <option value="30">Expires in 30 Days</option>
                        <option value="90">Expires in 90 Days</option>
                        <option value="365">Expires in 1 Year</option>
                        <option value="never">Never Expires (Not Recommended)</option>
                      </select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateKeyOpen(false)}
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreatingKey}
                      className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                    >
                      {isCreatingKey ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Token"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Display Raw Key ONCE */}
        {generatedKey && (
          <div className="border border-yellow-500/20 bg-yellow-500/5 p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-yellow-500">Copy your API token now</span>
                <p className="text-[10px] text-zinc-400 leading-snug">
                  For security, we cannot show this token to you again. Copy it and save it immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 bg-zinc-950 px-3 py-2 rounded border border-zinc-850 text-xs font-mono text-white select-all break-all">
                {generatedKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(generatedKey)}
                className="border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* API Key list */}
        <div className="space-y-3">
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg">
              <p className="text-zinc-500 text-sm">No programmatic API keys active.</p>
            </div>
          ) : (
            apiKeys.map((key) => {
              const scopeList = typeof key.scopes === "string" 
                ? JSON.parse(key.scopes) 
                : key.scopes || [];

              return (
                <div key={key.key_id} className="flex items-start justify-between p-3.5 border border-zinc-850 bg-zinc-900/30 rounded-lg">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-200 truncate">{key.label}</span>
                      <code className="text-[10px] font-mono text-zinc-500 px-1 bg-zinc-950 border border-zinc-850 rounded">
                        {key.key_prefix}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {scopeList.map((sc: string) => (
                        <span key={sc} className="text-[9px] font-bold text-purple-400 bg-purple-950/10 border border-purple-800/20 px-1.5 py-0.5 rounded">
                          {sc}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-zinc-500">
                      Created: {new Date(key.created_at).toLocaleDateString()}
                      {key.expires_at && ` • Expires: ${new Date(key.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>

                  {isAdminOrOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeApiKey(key.key_id)}
                      disabled={revokingKeyId === key.key_id}
                      className="hover:bg-red-500/10 hover:text-red-400 p-2 text-zinc-500"
                    >
                      {revokingKeyId === key.key_id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
