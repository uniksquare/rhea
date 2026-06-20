"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building, 
  Settings, 
  Trash2, 
  Check, 
  Loader2, 
  ExternalLink,
  GitBranch,
  Bell,
  Sliders,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Organization {
  org_id: string;
  name: string;
  created_at: string;
}

interface SettingsClientProps {
  organization: Organization;
  userRole?: string;
}

export function SettingsClient({ organization, userRole }: SettingsClientProps) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = userRole === "OWNER";
  const isAdminOrOwner = userRole === "ADMIN" || userRole === "OWNER";

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

  // Mock Connectors Data
  const connectors = [
    {
      id: "github",
      name: "GitHub App",
      desc: "Remediation subagent code commits and PR creations",
      status: "CONNECTED",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: GitBranch,
    },
    {
      id: "datadog",
      name: "Datadog",
      desc: "Ingest metrics, query traces, and scan active alert monitors",
      status: "AVAILABLE",
      badgeColor: "bg-zinc-800 text-zinc-500 border-zinc-700",
      icon: Globe,
    },
    {
      id: "prometheus",
      name: "Prometheus",
      desc: "PromQL metric queries to diagnose backend CPU/RAM spikes",
      status: "AVAILABLE",
      badgeColor: "bg-zinc-800 text-zinc-500 border-zinc-700",
      icon: Sliders,
    },
    {
      id: "slack",
      name: "Slack Notifications",
      desc: "Incident alerts and HITL human approval button prompts",
      status: "AVAILABLE",
      badgeColor: "bg-zinc-800 text-zinc-500 border-zinc-700",
      icon: Bell,
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Org Profile Settings */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building className="size-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Organization Profile</h2>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase">Organization ID</label>
            <code className="block bg-zinc-950 px-3 py-2 rounded border border-zinc-850 text-xs font-mono text-zinc-400 select-all">
              {organization.org_id}
            </code>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase">Organization Name</label>
            <Input
              required
              disabled={!isAdminOrOwner || isUpdating}
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-zinc-700"
            />
          </div>

          {isAdminOrOwner && (
            <Button
              type="submit"
              disabled={isUpdating || name.trim() === organization.name}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {isUpdating && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </form>
      </div>

      {/* 2. Pluggable Connectors Overview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Connector Integrations</h2>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
          Connect your observability stacks and collaborative channels so Rhea can fetch metrics, diagnose outages, and prompt engineers for approvals.
        </p>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          {connectors.map((conn) => {
            const Icon = conn.icon;
            return (
              <div 
                key={conn.id} 
                className="p-4 border border-zinc-850 bg-zinc-900/20 rounded-lg flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-purple-400 shrink-0">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-semibold text-zinc-200">{conn.name}</span>
                      <p className="text-[11px] text-zinc-500 leading-normal">{conn.desc}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${conn.badgeColor}`}>
                    {conn.status}
                  </span>
                </div>

                <div className="flex items-center justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-[10px] h-7 px-2.5 hover:text-white"
                  >
                    Configure
                    <ExternalLink className="size-3 ml-1.5 text-zinc-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Danger Zone */}
      {isOwner && (
        <div className="rounded-xl border border-red-900/30 bg-red-950/5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="size-5 text-red-500" />
            <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
            Deleting the organization is a permanent action. All incidents, user records, investigations, and API keys will be wiped. This action cannot be undone.
          </p>

          <div className="pt-2">
            <Button
              onClick={handleDeleteOrganization}
              disabled={isDeleting}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 gap-2 shadow-lg shadow-red-500/5"
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete Organization
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
