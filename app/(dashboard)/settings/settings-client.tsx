"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building, 
  Trash2, 
  Check, 
  Loader2, 
  Key,
  Plus,
  AlertTriangle,
  Copy
} from "lucide-react";
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

interface Organization {
  org_id: string;
  name: string;
  created_at: string;
}

interface ApiKey {
  key_id: string;
  key_prefix: string;
  label: string;
  scopes: string[] | any;
  expires_at: string | null;
  created_at: string;
}

interface SettingsClientProps {
  organization: Organization;
  initialApiKeys: ApiKey[];
  currentUser: {
    id?: string;
    email?: string | null;
    role?: string;
    orgId?: string;
  };
}

export function SettingsClient({ organization, initialApiKeys, currentUser }: SettingsClientProps) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // API Keys state and operations
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
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

  const isOwner = currentUser.role === "OWNER";
  const isAdminOrOwner = currentUser.role === "ADMIN" || currentUser.role === "OWNER";

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        throw new Error("Failed to update organization name");
      }

      alert("Organization name updated successfully!");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error updating organization name.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!isOwner) return;
    const confirmName = prompt(
      `WARNING: This will permanently delete the organization "${organization.name}" and all of its associated incidents, investigations, and configurations.\n\nType the organization name to confirm:`
    );

    if (confirmName !== organization.name) {
      alert("Organization name mismatch. Deletion cancelled.");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/org", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete organization");
      }

      alert("Organization deleted successfully.");
      window.location.href = "/auth/signin";
    } catch (err) {
      console.error(err);
      alert("Failed to delete organization.");
      setIsDeleting(false);
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
      
      const newKey: ApiKey = {
        key_id: data.key_id,
        key_prefix: data.key_prefix,
        label: data.label,
        scopes: data.scopes,
        expires_at: data.expires_at,
        created_at: data.created_at,
      };
      setApiKeys([newKey, ...apiKeys]);
      
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
    <div className="space-y-24">
      {/* 1. Org Profile Settings */}
      <div className="rounded border border-mist bg-paper-white p-24 space-y-16 shadow-sm">
        <div className="flex items-center gap-[8px]">
          <Building className="size-[20px] text-iris-violet" />
          <h2 className="font-lustria text-xl font-semibold text-graphite-ink">Organization Profile</h2>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-16 max-w-md">
          <div className="space-y-[4px]">
            <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Organization ID</label>
            <code className="block bg-soft-snow px-[12px] py-[8px] rounded border border-mist text-xs font-mono text-slate select-all break-all">
              {organization.org_id}
            </code>
          </div>

          <div className="space-y-[4px]">
            <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Organization Name</label>
            <Input
              required
              disabled={!isAdminOrOwner || isUpdating}
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden"
            />
          </div>

          {isAdminOrOwner && (
            <button
              type="submit"
              disabled={isUpdating || name.trim() === organization.name}
              className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {isUpdating && <Loader2 className="size-[14px] animate-spin" />}
              Save Changes
            </button>
          )}
        </form>
      </div>

      {/* 2. Programmatic API Keys (Moved here from Team) */}
      <div className="rounded border border-mist bg-paper-white p-24 flex flex-col gap-24 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Key className="size-[20px] text-iris-violet" />
            <h2 className="font-lustria text-xl font-semibold text-graphite-ink">Programmatic API Keys</h2>
          </div>
          {isAdminOrOwner && (
            <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
              <DialogTrigger asChild>
                <button className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none">
                  <Plus className="size-[14px]" />
                  Generate Key
                </button>
              </DialogTrigger>
              <DialogContent className="bg-paper-white border border-mist text-graphite-ink rounded-lg shadow-lg max-w-md w-full">
                <form onSubmit={handleCreateApiKey}>
                  <DialogHeader>
                    <DialogTitle className="font-lustria text-xl text-graphite-ink">Generate Programmatic API Key</DialogTitle>
                    <DialogDescription className="text-slate text-sm">
                      Create an API key for Slack webhooks, CLI integration, or CI/CD pipelines.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-16 py-16">
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Key Label</label>
                      <Input
                        required
                        placeholder="e.g. Jenkins CI/CD Pipeline"
                        value={keyLabel}
                        onChange={(e) => setKeyLabel(e.target.value)}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden"
                      />
                    </div>

                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Scopes / Permissions</label>
                      <div className="space-y-[8px]">
                        {availableScopes.map((scope) => (
                          <div 
                            key={scope.value}
                            onClick={() => handleToggleScope(scope.value)}
                            className={`flex items-start gap-[12px] p-[10px] rounded border text-left cursor-pointer transition-all ${
                              selectedScopes.includes(scope.value)
                                ? "bg-iris-violet/5 border-iris-violet/20 text-graphite-ink"
                                : "bg-paper-white border-mist text-slate hover:bg-soft-snow"
                            }`}
                          >
                            <input 
                              type="checkbox"
                              checked={selectedScopes.includes(scope.value)}
                              readOnly
                              className="mt-[4px] size-[14px] accent-iris-violet rounded border-mist bg-paper-white focus:ring-0"
                            />
                            <div className="space-y-[2px]">
                              <span className="text-xs font-semibold text-graphite-ink">{scope.label}</span>
                              <p className="text-[10px] text-slate leading-snug">{scope.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Expiration</label>
                      <select
                        value={keyExpires}
                        onChange={(e) => setKeyExpires(e.target.value)}
                        className="w-full bg-paper-white border border-mist rounded text-graphite-ink text-xs font-semibold px-[12px] py-[10px] focus:outline-hidden cursor-pointer"
                      >
                        <option value="30">Expires in 30 Days</option>
                        <option value="90">Expires in 90 Days</option>
                        <option value="365">Expires in 1 Year</option>
                        <option value="never">Never Expires (Not Recommended)</option>
                      </select>
                    </div>
                  </div>

                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => setIsCreateKeyOpen(false)}
                      className="border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingKey}
                      className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer"
                    >
                      {isCreatingKey ? (
                        <>
                          <Loader2 className="size-[14px] animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Token"
                      )}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Display Raw Key ONCE */}
        {generatedKey && (
          <div className="border border-amber-200 bg-amber-50/50 p-16 rounded space-y-[12px]">
            <div className="flex items-start gap-[10px]">
              <AlertTriangle className="size-[16px] text-amber-600 shrink-0 mt-[2px]" />
              <div className="space-y-[2px]">
                <span className="text-xs font-bold text-amber-800">Copy your API token now</span>
                <p className="text-[10px] text-slate leading-snug">
                  For security, we cannot show this token to you again. Copy it and save it immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-[8px]">
              <code className="flex-1 bg-soft-snow px-[12px] py-[8px] rounded border border-mist text-xs font-mono text-graphite-ink select-all break-all">
                {generatedKey}
              </code>
              <button
                onClick={() => copyToClipboard(generatedKey)}
                className="border border-mist bg-paper-white hover:bg-soft-snow text-slate hover:text-graphite-ink rounded px-[12px] py-[8px] font-mono text-[11px] uppercase tracking-wider flex items-center gap-[6px] transition-all cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="size-[12px] text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-[12px]" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* API Key list */}
        <div className="space-y-[12px]">
          {apiKeys.length === 0 ? (
            <div className="text-center py-[32px] border border-dashed border-mist rounded bg-soft-snow/30">
              <p className="text-slate text-sm">No programmatic API keys active.</p>
            </div>
          ) : (
            apiKeys.map((key) => {
              const scopeList = typeof key.scopes === "string" 
                ? JSON.parse(key.scopes) 
                : key.scopes || [];

              return (
                <div key={key.key_id} className="flex items-start justify-between p-[14px] border border-mist bg-soft-snow/30 rounded-lg">
                  <div className="space-y-[6px] min-w-0">
                    <div className="flex items-center gap-[8px]">
                      <span className="text-sm font-semibold text-graphite-ink truncate">{key.label}</span>
                      <code className="text-[10px] font-mono text-slate px-[6px] py-[2px] bg-paper-white border border-mist rounded">
                        {key.key_prefix}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-[6px]">
                      {scopeList.map((sc: string) => (
                        <span key={sc} className="text-[9px] font-bold text-iris-violet bg-iris-violet/5 border border-iris-violet/10 px-[6px] py-[2px] rounded">
                          {sc}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate">
                      Created: {new Date(key.created_at).toLocaleDateString()}
                      {key.expires_at && ` • Expires: ${new Date(key.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>

                  {isAdminOrOwner && (
                    <button
                      onClick={() => handleRevokeApiKey(key.key_id)}
                      disabled={revokingKeyId === key.key_id}
                      className="hover:bg-rose-50 hover:text-rose-600 p-[8px] text-slate rounded transition-all cursor-pointer border border-transparent hover:border-rose-100 flex items-center justify-center"
                    >
                      {revokingKeyId === key.key_id ? (
                        <Loader2 className="size-[16px] animate-spin" />
                      ) : (
                        <Trash2 className="size-[16px]" />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Danger Zone */}
      {isOwner && (
        <div className="rounded border border-rose-200 bg-rose-50/50 p-24 space-y-16 shadow-sm">
          <div className="flex items-center gap-[8px]">
            <Trash2 className="size-[20px] text-rose-600" />
            <h2 className="font-lustria text-xl font-semibold text-rose-800">Danger Zone</h2>
          </div>
          <p className="text-xs text-slate leading-relaxed max-w-xl">
            Deleting the organization is a permanent action. All incidents, user records, investigations, and API keys will be wiped. This action cannot be undone.
          </p>

          <div className="pt-[8px]">
            <button
              onClick={handleDeleteOrganization}
              disabled={isDeleting}
              className="bg-rose-100 hover:bg-rose-200/80 text-rose-700 border border-rose-200 hover:border-rose-300 rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none shadow-sm disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="size-[14px] animate-spin" />}
              Delete Organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
