"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Check, 
  Trash2, 
  Settings2,
  Plug,
  Loader2,
  AlertCircle,
  Search,
  Sparkles,
  Info,
  ExternalLink
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
} from "@/components/ui/dialog";

const LOGO_DEV_PUBLIC_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || 'pk_DVzJORPoQumYH3A-U6iG2g';

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

interface IntegrationMeta {
  type: string;
  name: string;
  domain: string;
  description: string;
  category: "observability" | "alerts" | "cloud" | "cicd" | "collaboration";
  capabilities: string[];
  isOperational: boolean;
  fields?: {
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: string[];
  }[];
}

const CATEGORIES = [
  { id: "all", label: "All Integrations" },
  { id: "configured", label: "Configured" },
  { id: "observability", label: "Observability" },
  { id: "alerts", label: "Alerts & On-Call" },
  { id: "cloud", label: "Cloud & Infrastructure" },
  { id: "cicd", label: "CI/CD & GitOps" },
  { id: "collaboration", label: "Collaboration" }
];

export function ConnectorsClient({ initialConnectors, user }: ConnectorsClientProps) {
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors);
  
  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Micro-interaction Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [requestedTypes, setRequestedTypes] = useState<string[]>([]);

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

  const connectorMetadata: IntegrationMeta[] = [
    {
      type: "datadog",
      name: "Datadog",
      domain: "datadoghq.com",
      description: "Ingest alerts, metrics, APM logs, and traces into Rhea's diagnostic workspace.",
      category: "observability",
      capabilities: ["Alert Ingest", "Metrics Sync", "APM Tracing"],
      isOperational: true,
      fields: [
        { key: "apiKey", label: "Datadog API Key", type: "password", placeholder: "dd_api_key_..." },
        { key: "appKey", label: "Datadog Application Key", type: "password", placeholder: "dd_app_key_..." },
        { key: "site", label: "Datadog Site Domain", type: "select", options: ["datadoghq.com", "datadoghq.eu", "us3.datadoghq.com", "us5.datadoghq.com"] }
      ]
    },
    {
      type: "prometheus",
      name: "Prometheus",
      domain: "prometheus.io",
      description: "Query system telemetry directly using PromQL queries to isolate high CPU/RAM resources.",
      category: "observability",
      capabilities: ["System Telemetry", "PromQL Queries"],
      isOperational: true,
      fields: [
        { key: "url", label: "Prometheus Server URL", type: "text", placeholder: "http://prometheus.local:9090" }
      ]
    },
    {
      type: "slack",
      name: "Slack Webhook",
      domain: "slack.com",
      description: "Establish communication channels for Rhea alert feeds and human-in-the-loop approvals.",
      category: "collaboration",
      capabilities: ["Notifications", "Approvals", "Interactive Chat"],
      isOperational: true,
      fields: [
        { key: "botToken", label: "Slack Bot User OAuth Token", type: "password", placeholder: "xoxb-..." },
        { key: "channelId", label: "Default Notification Channel ID", type: "text", placeholder: "C12345678" }
      ]
    },
    {
      type: "github",
      name: "GitHub API Gateway",
      domain: "github.com",
      description: "Enable checkout, diagnostic dry-runs, and direct fix branch patching via PR creation.",
      category: "cicd",
      capabilities: ["Workspace Sync", "PR Patching", "Actions API"],
      isOperational: true,
      fields: [
        { key: "personalAccessToken", label: "GitHub Personal Access Token", type: "password", placeholder: "ghp_..." },
        { key: "repository", label: "Target Code Repository", type: "text", placeholder: "org-name/repo-name" }
      ]
    },
    {
      type: "splunk",
      name: "Splunk Enterprise",
      domain: "splunk.com",
      description: "Fetch high-volume historical audit logs and run full-text indexing queries to locate container failures.",
      category: "observability",
      capabilities: ["Log Query", "Audit Indexing"],
      isOperational: false
    },
    {
      type: "elasticsearch",
      name: "Elasticsearch",
      domain: "elastic.co",
      description: "Search system logs, index failures, and query Elasticsearch cluster metrics dynamically.",
      category: "observability",
      capabilities: ["Full-Text Logs", "Cluster Health"],
      isOperational: false
    },
    {
      type: "grafana",
      name: "Grafana Cloud",
      domain: "grafana.com",
      description: "Annotate live dashboards during investigation timelines and query dashboard panels.",
      category: "observability",
      capabilities: ["Dashboard Annotations", "Panel Snapshot"],
      isOperational: false
    },
    {
      type: "newrelic",
      name: "New Relic",
      domain: "newrelic.com",
      description: "Ingest APM performance graphs, sync error rate spikes, and profile active workloads.",
      category: "observability",
      capabilities: ["Error Rates Sync", "Profiler Context"],
      isOperational: false
    },
    {
      type: "dynatrace",
      name: "Dynatrace",
      domain: "dynatrace.com",
      description: "Access Dynatrace AI-detected problems, smartscape cluster topologies, and event logs.",
      category: "observability",
      capabilities: ["AI Problem Feed", "Topology Mapping"],
      isOperational: false
    },
    {
      type: "pagerduty",
      name: "PagerDuty",
      domain: "pagerduty.com",
      description: "Automatically trigger Rhea subagents and sync on-call timeline updates.",
      category: "alerts",
      capabilities: ["Incident Triggers", "On-Call Sync"],
      isOperational: false
    },
    {
      type: "opsgenie",
      name: "Opsgenie",
      domain: "opsgenie.com",
      description: "Sync with on-call schedules, route critical notifications, and trigger automation checklists.",
      category: "alerts",
      capabilities: ["On-Call Sync", "Alert Routing"],
      isOperational: false
    },
    {
      type: "sentry",
      name: "Sentry",
      domain: "sentry.io",
      description: "Retrieve crash reports, map exceptions to stack traces, and fetch source maps.",
      category: "alerts",
      capabilities: ["Exception Tracking", "Stack Trace Ingest"],
      isOperational: false
    },
    {
      type: "bugsnag",
      name: "Bugsnag",
      domain: "bugsnag.com",
      description: "Incorporate application crash reports, session stats, and release tracking markers.",
      category: "alerts",
      capabilities: ["Crash Reports Ingest", "Session Stats"],
      isOperational: false
    },
    {
      type: "aws",
      name: "AWS CloudTrail & IAM",
      domain: "aws.amazon.com",
      description: "Trace AWS control-plane API calls, bad configs, and validate execution policies.",
      category: "cloud",
      capabilities: ["API Audit Logs", "Policy Evaluation"],
      isOperational: false
    },
    {
      type: "gcp",
      name: "Google Cloud Operations",
      domain: "cloud.google.com",
      description: "Ingest Google Cloud system operations logs, GKE cluster metrics, and compute instances.",
      category: "cloud",
      capabilities: ["GKE Log Aggregation", "Resource Sync"],
      isOperational: false
    },
    {
      type: "azure",
      name: "Azure Monitor",
      domain: "azure.microsoft.com",
      description: "Retrieve AKS diagnostic data, container logs, VM telemetry, and resource status alerts.",
      category: "cloud",
      capabilities: ["AKS Diagnostic Ingest", "Metric Alerts"],
      isOperational: false
    },
    {
      type: "argocd",
      name: "ArgoCD",
      domain: "argoproj.github.io",
      description: "Trigger automated GitOps state deployments, synchronization checks, and safe rollbacks.",
      category: "cicd",
      capabilities: ["Deployment Rollbacks", "State Sync"],
      isOperational: false
    },
    {
      type: "gitlab",
      name: "GitLab CI",
      domain: "gitlab.com",
      description: "Track pipeline results, build configurations, and trigger GitLab CI retry jobs.",
      category: "cicd",
      capabilities: ["Pipeline Status Checks", "Job Retries"],
      isOperational: false
    },
    {
      type: "terraform",
      name: "Terraform Cloud",
      domain: "terraform.io",
      description: "Execute safe infrastructure plans, validate modifications, and run dry-run audits.",
      category: "cicd",
      capabilities: ["Dry-Runs", "State Modification"],
      isOperational: false
    },
    {
      type: "jenkins",
      name: "Jenkins",
      domain: "jenkins.io",
      description: "Inspect pipeline outputs, parse build console statements, and invoke build jobs.",
      category: "cicd",
      capabilities: ["Build Log Inspection", "Trigger Builds"],
      isOperational: false
    },
    {
      type: "circleci",
      name: "CircleCI",
      domain: "circleci.com",
      description: "Track CircleCI workflow builds, pull job artifacts, and trigger pipeline events.",
      category: "cicd",
      capabilities: ["Workflow Triggers", "Artifacts Ingest"],
      isOperational: false
    },
    {
      type: "msteams",
      name: "Microsoft Teams",
      domain: "microsoft.com",
      description: "Broadcast adaptive updates and trigger interactive approval prompts directly in channels.",
      category: "collaboration",
      capabilities: ["Adaptive Cards", "Approval Feeds"],
      isOperational: false
    },
    {
      type: "discord",
      name: "Discord Webhooks",
      domain: "discord.com",
      description: "Publish alert timelines, log warnings, and send custom message payloads to server channels.",
      category: "collaboration",
      capabilities: ["Alert Feeds", "Status Broadcast"],
      isOperational: false
    },
    {
      type: "jira",
      name: "Jira Software",
      domain: "jira.com",
      description: "Create and update incident-linked tracking tickets and update issues upon resolution.",
      category: "collaboration",
      capabilities: ["Ticket Sync", "Smart Commits"],
      isOperational: false
    },
    {
      type: "linear",
      name: "Linear",
      domain: "linear.app",
      description: "Track software issues, sync backlog milestones, and link developer ticket states.",
      category: "collaboration",
      capabilities: ["Issue Sync", "Cycle Tracking"],
      isOperational: false
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
      showNotification(saved.message || "Integration settings stored securely.");
      setActiveModal(null);
      
      router.refresh();
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || "Error saving integration settings.");
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
      showNotification("Connector deleted successfully.");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      showNotification("Error deleting connector.");
    } finally {
      setDeletingId(null);
    }
  };

  // Toast Helper
  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Request Integration Micro-interaction
  const handleRequest = (name: string, type: string) => {
    if (requestedTypes.includes(type)) return;
    setRequestedTypes([...requestedTypes, type]);
    showNotification(`Integration request recorded for ${name}! We will prioritize this connector.`);
  };

  // Filtering Logic
  const filteredIntegrations = connectorMetadata.filter((meta) => {
    const matchesSearch = 
      meta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.capabilities.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
      meta.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "all") return true;
    if (activeTab === "configured") {
      return connectors.some(c => c.connectorType === meta.type);
    }
    return meta.category === activeTab;
  });

  const configuredConnectors = connectors.map((conn) => {
    const meta = connectorMetadata.find(m => m.type === conn.connectorType);
    return {
      ...conn,
      meta
    };
  });

  return (
    <div className="space-y-32">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-24 right-24 z-50 bg-graphite-ink text-paper-white px-16 py-12 rounded shadow-md border border-charcoal-hairline text-xs font-sans flex items-center gap-[12px] animate-in slide-in-from-bottom duration-250 select-none">
          <Info className="size-[14px] text-iris-violet shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header controls: Search & Category Tabs */}
      <div className="space-y-16">
        <div className="flex flex-col sm:flex-row gap-16 justify-between items-start sm:items-center">
          
          {/* Tab Filter Row */}
          <div className="flex flex-wrap gap-[6px] items-center">
            {CATEGORIES.map((cat) => {
              const isSelected = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-[10px] py-[4px] rounded text-[9px] font-mono uppercase tracking-wider border transition-all cursor-pointer select-none ${
                    isSelected 
                      ? "bg-iris-violet border-transparent text-paper-white shadow-sm font-semibold"
                      : "bg-paper-white border-mist text-slate hover:text-graphite-ink hover:border-slate/40"
                  }`}
                >
                  {cat.label}
                  {cat.id === "configured" && connectors.length > 0 && (
                    <span className="ml-[4px] px-[4px] py-[0.5px] text-[8px] bg-iris-violet/10 text-iris-violet rounded-full border border-iris-violet/20 font-bold">
                      {connectors.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search box input */}
          <div className="relative w-full sm:w-[260px] shrink-0">
            <Search className="absolute left-[12px] top-[10px] size-[14px] text-slate/50" />
            <Input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-[32px] pr-[12px] py-8 w-full bg-paper-white border border-mist text-graphite-ink placeholder:text-slate/40 focus:border-slate/40 rounded text-xs focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* 1. Installed Connectors Dashboard (Only shown when "configured" tab or "all" tab has them) */}
      {(activeTab === "all" || activeTab === "configured") && configuredConnectors.length > 0 && (
        <div className="space-y-16">
          <div className="flex items-center gap-8 border-b border-mist pb-8">
            <Plug className="size-16 text-iris-violet shrink-0" />
            <h2 className="font-lustria text-lg font-bold text-graphite-ink">Active Connectors</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
            {configuredConnectors.map((conn) => {
              const meta = conn.meta;
              if (!meta) return null;

              return (
                <div 
                  key={conn.instanceId} 
                  className="flex flex-col justify-between p-24 rounded border border-mist bg-paper-white hover:border-iris-violet/30 transition-all shadow-sm group"
                >
                  <div className="space-y-16">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-[12px]">
                        <div className="p-[8px] rounded border border-mist bg-soft-snow shrink-0 flex items-center justify-center size-[40px] select-none">
                          <img 
                            src={`https://img.logo.dev/${meta.domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=64`} 
                            alt={`${meta.name} logo`} 
                            className="size-24 object-contain"
                            onError={(e) => {
                              // fallback if logo fails
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-graphite-ink text-sm tracking-tight">{meta.name}</h3>
                          <p className="text-[10px] text-slate font-mono mt-[2px]">
                            {conn.displayName}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8">
                        <span className="text-[9px] uppercase font-mono tracking-wider px-[6px] py-[2px] rounded bg-iris-violet/5 border border-iris-violet/10 text-iris-violet select-none">
                          Active
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate leading-relaxed min-h-36">
                      {meta.description}
                    </p>

                    {/* Capabilities row */}
                    <div className="flex flex-wrap gap-4 pt-4">
                      {meta.capabilities.map((cap) => (
                        <span 
                          key={cap} 
                          className="px-[6px] py-[2px] rounded-full border border-mist bg-soft-snow font-mono text-[9px] uppercase tracking-wider text-slate"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-[12px] pt-16 border-t border-mist mt-24 shrink-0">
                    {isAdminOrOwner && (
                      <button
                        disabled={deletingId === conn.instanceId}
                        onClick={() => handleDeleteIntegration(conn.instanceId!)}
                        className="hover:bg-rose-50 hover:text-rose-600 p-[8px] text-slate rounded transition-all cursor-pointer border border-transparent hover:border-rose-100 flex items-center justify-center disabled:opacity-50"
                      >
                        {deletingId === conn.instanceId ? (
                          <Loader2 className="size-[16px] animate-spin" />
                        ) : (
                          <Trash2 className="size-[16px]" />
                        )}
                      </button>
                    )}
                    <button 
                      onClick={() => handleOpenSetup(meta.type, conn)}
                      className="bg-paper-white hover:bg-soft-snow text-graphite-ink border border-mist hover:border-slate/40 rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-[6px] shadow-sm select-none"
                    >
                      <Settings2 className="size-[14px]" />
                      Configure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Connection Marketplace Gallery */}
      <div className="space-y-16">
        <div className="flex items-center gap-8 border-b border-mist pb-8">
          <Sparkles className="size-16 text-iris-violet shrink-0" />
          <h2 className="font-lustria text-lg font-bold text-graphite-ink">
            {activeTab === "configured" ? "Configured Integrations Catalog" : "Integrations Marketplace"}
          </h2>
          {filteredIntegrations.length > 0 && (
            <span className="text-[10px] font-mono text-slate/60 ml-auto select-none">
              Showing {filteredIntegrations.length} available
            </span>
          )}
        </div>

        {filteredIntegrations.length === 0 ? (
          <div className="p-48 border border-dashed border-mist text-center space-y-8 rounded bg-soft-snow/35">
            <Plug className="size-32 text-slate/40 mx-auto" />
            <p className="text-slate text-sm">No integrations match your active filters or search terms.</p>
            <button 
              onClick={() => { setSearchQuery(""); setActiveTab("all"); }} 
              className="text-xs font-mono uppercase text-iris-violet hover:underline pt-8"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
            {filteredIntegrations.map((meta) => {
              const configured = connectors.find(c => c.connectorType === meta.type);
              const requested = requestedTypes.includes(meta.type);

              return (
                <div 
                  key={meta.type} 
                  className={`flex flex-col justify-between p-24 rounded border transition-all ${
                    configured 
                      ? "border-iris-violet/20 bg-iris-violet/5/5 shadow-xs" 
                      : "border-mist bg-paper-white hover:border-slate/40"
                  } group`}
                >
                  <div className="space-y-16">
                    <div className="flex items-center justify-between">
                      
                      {/* Logo & Name */}
                      <div className="flex items-center gap-[12px]">
                        <div className="p-[8px] rounded border border-mist bg-soft-snow shrink-0 flex items-center justify-center size-[40px] select-none">
                          <img 
                            src={`https://img.logo.dev/${meta.domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=64`} 
                            alt={`${meta.name} logo`} 
                            className="size-24 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-graphite-ink text-sm tracking-tight">{meta.name}</h3>
                          <span className="text-[9px] uppercase font-mono tracking-wider text-slate/60 block mt-[2px]">
                            {meta.category}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      {configured ? (
                        <span className="text-[9px] uppercase font-mono tracking-wider text-iris-violet bg-iris-violet/5 border border-iris-violet/10 px-[6px] py-[2px] rounded select-none">
                          Installed
                        </span>
                      ) : meta.isOperational ? (
                        <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-[6px] py-[2px] rounded select-none">
                          Operational
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate/50 bg-soft-snow border border-mist/50 px-[6px] py-[2px] rounded select-none">
                          Upcoming
                        </span>
                      )}

                    </div>

                    <p className="text-xs text-slate leading-relaxed min-h-36">
                      {meta.description}
                    </p>

                    {/* Capabilities row */}
                    <div className="flex flex-wrap gap-4 pt-4">
                      {meta.capabilities.map((cap) => (
                        <span 
                          key={cap} 
                          className="px-[6px] py-[2px] rounded-full border border-mist bg-soft-snow font-mono text-[9px] uppercase tracking-wider text-slate"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-16 border-t border-mist mt-24 shrink-0">
                    {configured ? (
                      <button
                        onClick={() => handleOpenSetup(meta.type, configured)}
                        className="bg-paper-white hover:bg-soft-snow text-graphite-ink border border-mist rounded px-[12px] py-[8px] font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-[6px]"
                      >
                        <Settings2 className="size-[12px]" />
                        Configure
                      </button>
                    ) : meta.isOperational ? (
                      <button
                        disabled={!isAdminOrOwner}
                        onClick={() => handleOpenSetup(meta.type)}
                        className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[10px] uppercase tracking-wider px-[12px] py-[8px] flex items-center gap-[6px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                      >
                        <Plug className="size-[12px]" />
                        Setup Connector
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequest(meta.name, meta.type)}
                        className={`font-mono text-[10px] uppercase tracking-wider rounded px-[12px] py-[8px] transition-all cursor-pointer border flex items-center gap-[4px] select-none ${
                          requested 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 cursor-default" 
                            : "bg-paper-white border-mist text-slate hover:text-graphite-ink hover:bg-soft-snow/40"
                        }`}
                      >
                        {requested ? (
                          <>
                            <Check className="size-[12px]" />
                            Requested
                          </>
                        ) : (
                          <>
                            <ExternalLink className="size-[10px] text-slate/50" />
                            Request Setup
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integration Setup Dialog */}
      {activeModal && (
        <Dialog open={true} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="bg-paper-white border border-mist text-graphite-ink rounded-lg shadow-lg max-w-md w-full">
            <form onSubmit={handleSaveIntegration}>
              <DialogHeader>
                <DialogTitle className="font-lustria text-xl text-graphite-ink flex items-center gap-[8px]">
                  <Plug className="size-[20px] text-iris-violet" />
                  Configure {activeModal.charAt(0).toUpperCase() + activeModal.slice(1)}
                </DialogTitle>
                <DialogDescription className="text-slate text-sm">
                  Provide credentials and parameters to establish secure tenant metrics ingest channels.
                </DialogDescription>
              </DialogHeader>

              {/* Form Input fields */}
              <div className="space-y-16 py-16 shrink-0">
                <div className="space-y-[4px]">
                  <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Display Label</label>
                  <Input 
                    required
                    placeholder="e.g. Production Datadog"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                  />
                </div>

                {activeModal === "datadog" && (
                  <>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Datadog API Key</label>
                      <Input 
                        required
                        type="password"
                        placeholder="dd_api_key_..."
                        value={datadogConfig.apiKey}
                        onChange={(e) => setDatadogConfig({ ...datadogConfig, apiKey: e.target.value })}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                      />
                    </div>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Datadog Application Key</label>
                      <Input 
                        required
                        type="password"
                        placeholder="dd_app_key_..."
                        value={datadogConfig.appKey}
                        onChange={(e) => setDatadogConfig({ ...datadogConfig, appKey: e.target.value })}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                      />
                    </div>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Datadog Site</label>
                      <select
                        value={datadogConfig.site}
                        onChange={(e) => setDatadogConfig({ ...datadogConfig, site: e.target.value })}
                        className="w-full bg-paper-white border border-mist rounded text-graphite-ink text-xs font-semibold px-[12px] py-[10px] focus:outline-hidden cursor-pointer"
                      >
                        <option value="datadoghq.com" className="bg-paper-white text-graphite-ink">datadoghq.com (US1)</option>
                        <option value="datadoghq.eu" className="bg-paper-white text-graphite-ink">datadoghq.eu (EU)</option>
                        <option value="us3.datadoghq.com" className="bg-paper-white text-graphite-ink">us3.datadoghq.com (US3)</option>
                        <option value="us5.datadoghq.com" className="bg-paper-white text-graphite-ink">us5.datadoghq.com (US5)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeModal === "prometheus" && (
                  <div className="space-y-[4px]">
                    <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Prometheus Endpoint URL</label>
                    <Input 
                      required
                      placeholder="http://prometheus-service.monitoring.svc.cluster.local:9090"
                      value={prometheusConfig.url}
                      onChange={(e) => setPrometheusConfig({ url: e.target.value })}
                      className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                    />
                  </div>
                )}

                {activeModal === "slack" && (
                  <>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Bot User OAuth Token</label>
                      <Input 
                        required
                        type="password"
                        placeholder="xoxb-..."
                        value={slackConfig.botToken}
                        onChange={(e) => setSlackConfig({ ...slackConfig, botToken: e.target.value })}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                      />
                    </div>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Default Channel ID</label>
                      <Input 
                        required
                        placeholder="C12345678"
                        value={slackConfig.channelId}
                        onChange={(e) => setSlackConfig({ ...slackConfig, channelId: e.target.value })}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                      />
                    </div>
                  </>
                )}

                {activeModal === "github" && (
                  <>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Personal Access Token</label>
                      <Input 
                        required
                        type="password"
                        placeholder="ghp_... or github_pat_..."
                        value={githubConfig.personalAccessToken}
                        onChange={(e) => setGithubConfig({ ...githubConfig, personalAccessToken: e.target.value })}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                      />
                    </div>
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Target Repository (owner/repo)</label>
                      <Input 
                        required
                        placeholder="acme-corp/rhea-app"
                        value={githubConfig.repository}
                        onChange={(e) => setGithubConfig({ ...githubConfig, repository: e.target.value })}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden text-xs"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Handshake connection test results */}
              {testResult && (
                <div className={`p-[12px] rounded border text-xs leading-relaxed flex items-start gap-[8px] mb-16 animate-in fade-in duration-300 ${
                  testResult.success 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}>
                  {testResult.success ? (
                    <Check className="size-[16px] shrink-0 mt-[2px] text-emerald-600" />
                  ) : (
                    <AlertCircle className="size-[16px] shrink-0 mt-[2px] text-rose-600" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <DialogFooter className="flex flex-row gap-[8px] w-full mt-16">
                <button
                  type="button"
                  disabled={isTesting || isSaving}
                  onClick={handleTestConnection}
                  className="flex-1 bg-paper-white hover:bg-soft-snow text-graphite-ink border border-mist hover:border-slate/40 rounded py-[10px] font-sans font-semibold text-xs tracking-tight transition-all cursor-pointer shadow-sm select-none flex items-center justify-center gap-[4px] disabled:opacity-50 min-w-0"
                >
                  {isTesting && <Loader2 className="size-[12px] animate-spin shrink-0" />}
                  <span className="truncate">Test Connection</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 bg-paper-white hover:bg-soft-snow text-slate hover:text-graphite-ink border border-mist rounded py-[10px] font-sans font-semibold text-xs tracking-tight transition-all cursor-pointer shadow-sm select-none text-center min-w-0 truncate"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving || isTesting}
                  className="flex-1 bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded py-[10px] font-sans font-semibold text-xs tracking-tight flex items-center justify-center gap-[4px] transition-all cursor-pointer disabled:opacity-50 min-w-0"
                >
                  {isSaving && <Loader2 className="size-[12px] animate-spin shrink-0" />}
                  <span className="truncate">Save</span>
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
