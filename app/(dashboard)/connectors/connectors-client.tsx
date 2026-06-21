"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Activity, 
  Database, 
  MessageSquare, 
  Terminal, 
  Check, 
  Trash2, 
  Settings2,
  Plug,
  Loader2,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Connector {
  instanceId?: string;
  connectorType: string;
  displayName: string;
  status: string;
  lastHealthCheck: string | null;
  config: Record<string, string>;
}

interface ConnectorsClientProps {
  initialConnectors: Connector[];
  user: {
    id?: string;
    email?: string | null;
    role?: string;
    orgId?: string;
  };
}

export function ConnectorsClient({ initialConnectors, user }: ConnectorsClientProps) {
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors);
  
  // Modal State
  const [activeModal, setActiveModal] = useState<string | null>(null); // "datadog" | "prometheus" | "slack" | "github" | null
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);

  // Form Fields
  const [displayName, setDisplayName] = useState("");
  const [datadogConfig, setDatadogConfig] = useState({ apiKey: "", appKey: "", site: "datadoghq.com" });
  const [prometheusConfig, setPrometheusConfig] = useState({ url: "" });
  const [slackConfig, setSlackConfig] = useState({ botToken: "", channelId: "" });
  const [githubConfig, setGithubConfig] = useState({ personalAccessToken: "", repository: "" });

  // Loading & Testing states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdminOrOwner = user.role === "ADMIN" || user.role === "OWNER";

  const connectorMetadata = [
    {
      type: "datadog",
      name: "Datadog",
      icon: Activity,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      description: "Ingest alerts, metrics, APM logs, and traces into Rhea's diagnostic workspace.",
      fields: [
        { key: "apiKey", label: "Datadog API Key", type: "password", placeholder: "dd_api_key_..." },
        { key: "appKey", label: "Datadog Application Key", type: "password", placeholder: "dd_app_key_..." },
        { key: "site", label: "Datadog Site Domain", type: "select", options: ["datadoghq.com", "datadoghq.eu", "us3.datadoghq.com", "us5.datadoghq.com"] }
      ]
    },
    {
      type: "prometheus",
      name: "Prometheus",
      icon: Database,
      color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
      description: "Query system telemetry directly using PromQL queries to isolate high CPU/RAM resources.",
      fields: [
        { key: "url", label: "Prometheus Server URL", type: "text", placeholder: "http://prometheus.local:9090" }
      ]
    },
    {
      type: "slack",
      name: "Slack Webhook",
      icon: MessageSquare,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      description: "Establish communication channels for Rhea alert feeds and human-in-the-loop approvals.",
      fields: [
        { key: "botToken", label: "Slack Bot User OAuth Token", type: "password", placeholder: "xoxb-..." },
        { key: "channelId", label: "Default Notification Channel ID", type: "text", placeholder: "C12345678" }
      ]
    },
    {
      type: "github",
      name: "GitHub API Gateway",
      icon: Terminal,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      description: "Enable checkout, diagnostic dry-runs, and direct fix branch patching via PR creation.",
      fields: [
        { key: "personalAccessToken", label: "GitHub Personal Access Token", type: "password", placeholder: "ghp_..." },
        { key: "repository", label: "Target Code Repository", type: "text", placeholder: "org-name/repo-name" }
      ]
    }
  ];

  const handleOpenSetup = (type: string, existing: Connector | null = null) => {
    setActiveModal(type);
    setTestResult(null);
    if (existing) {
      setEditingConnector(existing);
      setDisplayName(existing.displayName);
      if (type === "datadog") {
        setDatadogConfig({
          apiKey: existing.config.apiKey || "",
          appKey: existing.config.appKey || "",
          site: existing.config.site || "datadoghq.com",
        });
      } else if (type === "prometheus") {
        setPrometheusConfig({ url: existing.config.url || "" });
      } else if (type === "slack") {
        setSlackConfig({
          botToken: existing.config.botToken || "",
          channelId: existing.config.channelId || "",
        });
      } else if (type === "github") {
        setGithubConfig({
          personalAccessToken: existing.config.personalAccessToken || "",
          repository: existing.config.repository || "",
        });
      }
    } else {
      setEditingConnector(null);
      setDisplayName(`${type.charAt(0).toUpperCase() + type.slice(1)} Integration`);
      setDatadogConfig({ apiKey: "", appKey: "", site: "datadoghq.com" });
      setPrometheusConfig({ url: "" });
      setSlackConfig({ botToken: "", channelId: "" });
      setGithubConfig({ personalAccessToken: "", repository: "" });
    }
  };

  const getActiveConfig = (type: string) => {
    if (type === "datadog") return datadogConfig;
    if (type === "prometheus") return prometheusConfig;
    if (type === "slack") return slackConfig;
    return githubConfig;
  };

  const handleTestConnection = async () => {
    if (!activeModal) return;
    setIsTesting(true);
    setTestResult(null);

    const config = getActiveConfig(activeModal);

    try {
      const res = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorType: activeModal, config }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error || "Connection test failed." });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: "Network error during connection handshake check." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || isSaving) return;

    setIsSaving(true);
    const config = getActiveConfig(activeModal);

    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: editingConnector?.instanceId || undefined,
          connectorType: activeModal,
          displayName: displayName || `${activeModal} Integration`,
          config,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save integration settings");
      }

      const saved = await res.json();
      alert(saved.message || "Integration settings stored securely.");
      setActiveModal(null);
      
      // Update local state by reloading page elements
      router.refresh();
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error saving integration settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteIntegration = async (instanceId: string) => {
    if (!confirm("Are you sure you want to delete this connector? Rhea subagents will no longer be able to query its telemetry logs.")) return;
    
    setDeletingId(instanceId);
    try {
      const res = await fetch(`/api/connectors/${instanceId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete integration");
      }

      setConnectors(connectors.filter(c => c.instanceId !== instanceId));
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert("Error deleting connector.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Active Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {connectorMetadata.map((meta) => {
          const Icon = meta.icon;
          const activeInstance = connectors.find(c => c.connectorType === meta.type);

          return (
            <div 
              key={meta.type} 
              className="flex flex-col justify-between p-6 rounded-xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-xs hover:border-zinc-700/80 transition-all group"
            >
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${meta.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm tracking-tight">{meta.name}</h3>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {activeInstance ? activeInstance.displayName : "No configuration"}
                      </p>
                    </div>
                  </div>
                  <Badge className={activeInstance 
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-400 font-semibold" 
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 font-semibold"
                  }>
                    {activeInstance ? "Connected" : "Inactive"}
                  </Badge>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed min-h-36">
                  {meta.description}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-900 mt-6 shrink-0">
                {activeInstance ? (
                  <>
                    {isAdminOrOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === activeInstance.instanceId}
                        onClick={() => handleDeleteIntegration(activeInstance.instanceId!)}
                        className="hover:bg-red-500/10 text-zinc-400 hover:text-red-400 p-2 border border-transparent hover:border-red-500/20 rounded-lg transition-all"
                      >
                        {deletingId === activeInstance.instanceId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    )}
                    <Button 
                      size="sm"
                      onClick={() => handleOpenSetup(meta.type, activeInstance)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold px-4 rounded-lg flex items-center gap-1.5"
                    >
                      <Settings2 className="size-3.5" />
                      Configure
                    </Button>
                  </>
                ) : (
                  <Button 
                    size="sm"
                    disabled={!isAdminOrOwner}
                    onClick={() => handleOpenSetup(meta.type)}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 rounded-lg flex items-center gap-1.5 shadow-md shadow-purple-500/5 disabled:opacity-50"
                  >
                    <Plug className="size-3.5" />
                    Setup Connector
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration Setup Dialog */}
      {activeModal && (
        <Dialog open={true} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl shadow-2xl max-w-md w-full">
            <form onSubmit={handleSaveIntegration}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Plug className="size-5 text-purple-400" />
                  Configure {activeModal.charAt(0).toUpperCase() + activeModal.slice(1)}
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs">
                  Provide credentials and parameters to establish secure tenant metrics ingest channels.
                </DialogDescription>
              </DialogHeader>

              {/* Form Input fields */}
              <div className="space-y-4 py-4 shrink-0">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Display Label</label>
                  <Input 
                    required
                    placeholder="e.g. Production Datadog"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                  />
                </div>

                {activeModal === "datadog" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Datadog API Key</label>
                      <Input 
                        required
                        type="password"
                        placeholder="dd_api_key_..."
                        value={datadogConfig.apiKey}
                        onChange={(e) => setDatadogConfig({ ...datadogConfig, apiKey: e.target.value })}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Datadog Application Key</label>
                      <Input 
                        required
                        type="password"
                        placeholder="dd_app_key_..."
                        value={datadogConfig.appKey}
                        onChange={(e) => setDatadogConfig({ ...datadogConfig, appKey: e.target.value })}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Datadog Site</label>
                      <select
                        value={datadogConfig.site}
                        onChange={(e) => setDatadogConfig({ ...datadogConfig, site: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-hidden cursor-pointer"
                      >
                        <option value="datadoghq.com" className="bg-zinc-950">datadoghq.com (US1)</option>
                        <option value="datadoghq.eu" className="bg-zinc-950">datadoghq.eu (EU)</option>
                        <option value="us3.datadoghq.com" className="bg-zinc-950">us3.datadoghq.com (US3)</option>
                        <option value="us5.datadoghq.com" className="bg-zinc-950">us5.datadoghq.com (US5)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeModal === "prometheus" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Prometheus Endpoint URL</label>
                    <Input 
                      required
                      placeholder="http://prometheus-service.monitoring.svc.cluster.local:9090"
                      value={prometheusConfig.url}
                      onChange={(e) => setPrometheusConfig({ url: e.target.value })}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                    />
                  </div>
                )}

                {activeModal === "slack" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Bot User OAuth Token</label>
                      <Input 
                        required
                        type="password"
                        placeholder="xoxb-..."
                        value={slackConfig.botToken}
                        onChange={(e) => setSlackConfig({ ...slackConfig, botToken: e.target.value })}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Default Channel ID</label>
                      <Input 
                        required
                        placeholder="C12345678"
                        value={slackConfig.channelId}
                        onChange={(e) => setSlackConfig({ ...slackConfig, channelId: e.target.value })}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                      />
                    </div>
                  </>
                )}

                {activeModal === "github" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Personal Access Token</label>
                      <Input 
                        required
                        type="password"
                        placeholder="ghp_... or github_pat_..."
                        value={githubConfig.personalAccessToken}
                        onChange={(e) => setGithubConfig({ ...githubConfig, personalAccessToken: e.target.value })}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">Target Repository (owner/repo)</label>
                      <Input 
                        required
                        placeholder="acme-corp/rhea-app"
                        value={githubConfig.repository}
                        onChange={(e) => setGithubConfig({ ...githubConfig, repository: e.target.value })}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-lg text-xs"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Handshake connection test results */}
              {testResult && (
                <div className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 mb-4 animate-in fade-in duration-300 ${
                  testResult.success 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/5 border-red-500/20 text-red-400"
                }`}>
                  {testResult.success ? (
                    <Check className="size-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <DialogFooter className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  disabled={isTesting || isSaving}
                  onClick={handleTestConnection}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-semibold px-4 flex items-center gap-1.5"
                >
                  {isTesting && <Loader2 className="size-3.5 animate-spin" />}
                  Test Connection
                </Button>
                
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveModal(null)}
                    className="hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving || isTesting}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg px-4 flex items-center gap-1.5"
                  >
                    {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                    Save Integration
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
