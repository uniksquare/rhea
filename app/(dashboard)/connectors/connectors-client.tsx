"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Trash2,
  Plug,
  Loader2,
  Search,
  Sparkles,
  Info,
  ExternalLink,
  ShieldCheck,
  Zap,
  LogOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const LOGO_DEV_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_LOGO_DEV_KEY || "pk_DVzJORPoQumYH3A-U6iG2g";

/* ─────────────────────── Types ─────────────────────── */

interface Connector {
  instanceId?: string;
  connectorType: string;
  displayName: string;
  mcpUrl: string;
  connectProviderId: string;
  connectedBy: string | null;
  status: string;
  lastHealthCheck: string | null;
  connectedAt: string | null;
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
  mcpUrl: string;
  category: "observability" | "alerts" | "cloud" | "collaboration";
  capabilities: string[];
  writeExamples: string[];
}

/* ─────────────────── Category Tabs ─────────────────── */

const CATEGORIES = [
  { id: "all", label: "All Integrations" },
  { id: "connected", label: "Connected" },
  { id: "observability", label: "Observability" },
  { id: "alerts", label: "Alerts & On-Call" },
  { id: "cloud", label: "Cloud & Infrastructure" },
  { id: "collaboration", label: "Collaboration" },
];

/* ───────────── MCP Connector Metadata Registry ────────────── */

const CONNECTOR_REGISTRY: IntegrationMeta[] = [
  {
    type: "sentry",
    name: "Sentry",
    domain: "sentry.io",
    mcpUrl: "mcp.sentry.dev/sse",
    description:
      "Error tracking and performance monitoring. Retrieve issues, stack traces, breadcrumbs, and release health.",
    category: "alerts",
    capabilities: ["Exception Tracking", "Stack Traces", "Release Health"],
    writeExamples: ["Resolve issues", "Assign issues"],
  },
  {
    type: "datadog",
    name: "Datadog",
    domain: "datadoghq.com",
    mcpUrl: "mcp.datadoghq.com/sse",
    description:
      "Observability platform. Query logs, APM traces, metrics, monitors, and dashboards for diagnostics.",
    category: "observability",
    capabilities: ["Log Search", "APM Traces", "Metrics", "Monitors"],
    writeExamples: ["Mute monitors", "Create dashboards"],
  },
  {
    type: "github",
    name: "GitHub",
    domain: "github.com",
    mcpUrl: "api.githubcopilot.com/mcp/",
    description:
      "Code platform. Search repos, read files and PRs, create branches, push commits, and open pull requests.",
    category: "collaboration",
    capabilities: ["Code Search", "PR Lifecycle", "Issues", "Actions"],
    writeExamples: ["Create PRs", "Push commits", "Create issues"],
  },
  {
    type: "aws",
    name: "AWS",
    domain: "aws.amazon.com",
    mcpUrl: "mcp.amazonaws.com",
    description:
      "Cloud infrastructure. CloudWatch logs, EKS clusters, EC2 instances, IAM policies, CloudTrail events.",
    category: "cloud",
    capabilities: ["CloudWatch", "EKS", "EC2", "IAM", "CloudTrail"],
    writeExamples: ["Modify security groups", "Scale instances"],
  },
  {
    type: "slack",
    name: "Slack",
    domain: "slack.com",
    mcpUrl: "mcp.slack.com/sse",
    description:
      "Workspace communication. Search messages, read channels, post updates, and coordinate incident response.",
    category: "collaboration",
    capabilities: ["Message Search", "Channel History", "Post Updates"],
    writeExamples: ["Post messages", "Reply to threads"],
  },
  {
    type: "linear",
    name: "Linear",
    domain: "linear.app",
    mcpUrl: "mcp.linear.app/sse",
    description:
      "Project management. Search issues, list projects and cycles, create incident tickets, and track workload.",
    category: "collaboration",
    capabilities: ["Issue Tracking", "Cycles", "Projects", "Comments"],
    writeExamples: ["Create issues", "Update status", "Add comments"],
  },
  {
    type: "pagerduty",
    name: "PagerDuty",
    domain: "pagerduty.com",
    mcpUrl: "mcp.pagerduty.com/mcp",
    description:
      "Incident management. List incidents, check on-call schedules, query services, and acknowledge alerts.",
    category: "alerts",
    capabilities: ["Incidents", "On-Call", "Escalations", "Services"],
    writeExamples: ["Acknowledge incidents", "Resolve alerts"],
  },
];

/* ═══════════════════════ Component ═══════════════════════ */

export function ConnectorsClient({
  initialConnectors,
  user,
}: ConnectorsClientProps) {
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Loading states
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const isAdminOrOwner = user.role === "ADMIN" || user.role === "OWNER";

  /* ─────────── Toast Helper ─────────── */
  const showNotification = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  /* ─────────── Poll connection status after OAuth redirect ─────────── */
  useEffect(() => {
    // Check URL params for post-OAuth callback
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (connected) {
      showNotification(
        `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`
      );
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showNotification]);

  /* ─────────── Connect via OAuth ─────────── */
  const handleConnect = async (meta: IntegrationMeta) => {
    if (!isAdminOrOwner || connectingType) return;
    setConnectingType(meta.type);

    try {
      // Register the connector in our database
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorType: meta.type,
          displayName: meta.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to register connector");
      }

      const data = await res.json();
      showNotification(data.message || `${meta.name} connected`);
      router.refresh();
      
      if (data.authorizationUrl) {
        // Redirect directly to the interactive OAuth flow
        window.location.href = data.authorizationUrl;
      } else {
        // Fallback to reload if auth URL is not generated
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || "Connection failed");
    } finally {
      setConnectingType(null);
    }
  };

  /* ─────────── Disconnect ─────────── */
  const handleDisconnect = async (instanceId: string, name: string) => {
    if (
      !confirm(
        `Disconnect ${name}? Rhea will no longer be able to access this service's tools during investigations.`
      )
    )
      return;

    setDisconnectingId(instanceId);
    try {
      const res = await fetch(`/api/connectors/${instanceId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to disconnect");

      setConnectors(connectors.filter((c) => c.instanceId !== instanceId));
      showNotification(`${name} disconnected`);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      showNotification("Error disconnecting connector");
    } finally {
      setDisconnectingId(null);
    }
  };

  /* ─────────── Filtering ─────────── */
  const filteredIntegrations = CONNECTOR_REGISTRY.filter((meta) => {
    const matchesSearch =
      meta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.capabilities.some((c) =>
        c.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      meta.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === "all") return true;
    if (activeTab === "connected") {
      return connectors.some((c) => c.connectorType === meta.type);
    }
    return meta.category === activeTab;
  });

  const connectedCount = connectors.length;

  /* ═══════════════════════ Render ═══════════════════════ */
  return (
    <div className="space-y-32">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 right-24 z-50 bg-graphite-ink text-paper-white px-16 py-12 rounded shadow-md border border-charcoal-hairline text-xs font-sans flex items-center gap-[12px] animate-in slide-in-from-bottom duration-250 select-none">
          <Info className="size-[14px] text-iris-violet shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MCP Protocol Badge */}
      <div className="flex items-center gap-[8px] px-[12px] py-[8px] rounded border border-iris-violet/15 bg-iris-violet/5 w-fit">
        <ShieldCheck className="size-[14px] text-iris-violet" />
        <span className="text-[10px] font-mono text-iris-violet tracking-wider uppercase font-semibold">
          MCP Protocol · OAuth 2.1 · Vercel Connect
        </span>
      </div>

      {/* Header controls */}
      <div className="space-y-16">
        <div className="flex flex-col sm:flex-row gap-16 justify-between items-start sm:items-center">
          {/* Tab Filter */}
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
                  {cat.id === "connected" && connectedCount > 0 && (
                    <span className="ml-[4px] px-[4px] py-[0.5px] text-[8px] bg-iris-violet/10 text-iris-violet rounded-full border border-iris-violet/20 font-bold">
                      {connectedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
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

      {/* Connected Connectors Dashboard */}
      {(activeTab === "all" || activeTab === "connected") &&
        connectors.length > 0 && (
          <div className="space-y-16">
            <div className="flex items-center gap-8 border-b border-mist pb-8">
              <Zap className="size-16 text-iris-violet shrink-0" />
              <h2 className="font-lustria text-lg font-bold text-graphite-ink">
                Active Connections
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              {connectors.map((conn) => {
                const meta = CONNECTOR_REGISTRY.find(
                  (m) => m.type === conn.connectorType
                );
                if (!meta) return null;

                return (
                  <div
                    key={conn.instanceId}
                    className="flex flex-col justify-between p-24 rounded border border-iris-violet/20 bg-paper-white hover:border-iris-violet/30 transition-all shadow-sm group"
                  >
                    <div className="space-y-16">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-[12px]">
                          <div className="p-[8px] rounded border border-iris-violet/10 bg-iris-violet/5 shrink-0 flex items-center justify-center size-[40px] select-none">
                            <img
                              src={`https://img.logo.dev/${meta.domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=64`}
                              alt={`${meta.name} logo`}
                              className="size-24 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-graphite-ink text-sm tracking-tight">
                              {meta.name}
                            </h3>
                            <p className="text-[10px] text-slate font-mono mt-[2px]">
                              {meta.mcpUrl}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-[6px]">
                          <span className="flex items-center gap-[4px] text-[9px] uppercase font-mono tracking-wider px-[6px] py-[2px] rounded bg-emerald-50 border border-emerald-100 text-emerald-700 select-none">
                            <Check className="size-[10px]" />
                            Connected
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate leading-relaxed min-h-36">
                        {meta.description}
                      </p>

                      {/* Capabilities */}
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

                      {/* Connection metadata */}
                      {conn.connectedAt && (
                        <p className="text-[10px] text-slate/50 font-mono">
                          Connected{" "}
                          {new Date(conn.connectedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-[12px] pt-16 border-t border-mist mt-24 shrink-0">
                      {isAdminOrOwner && (
                        <button
                          disabled={disconnectingId === conn.instanceId}
                          onClick={() =>
                            handleDisconnect(conn.instanceId!, meta.name)
                          }
                          className="hover:bg-rose-50 hover:text-rose-600 p-[8px] text-slate rounded transition-all cursor-pointer border border-transparent hover:border-rose-100 flex items-center justify-center gap-[4px] disabled:opacity-50 text-[10px] font-mono uppercase tracking-wider"
                        >
                          {disconnectingId === conn.instanceId ? (
                            <Loader2 className="size-[14px] animate-spin" />
                          ) : (
                            <>
                              <LogOut className="size-[14px]" />
                              Disconnect
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Connector Marketplace Gallery */}
      <div className="space-y-16">
        <div className="flex items-center gap-8 border-b border-mist pb-8">
          <Sparkles className="size-16 text-iris-violet shrink-0" />
          <h2 className="font-lustria text-lg font-bold text-graphite-ink">
            {activeTab === "connected"
              ? "Connected Integrations"
              : "MCP Integrations"}
          </h2>
          {filteredIntegrations.length > 0 && (
            <span className="text-[10px] font-mono text-slate/60 ml-auto select-none">
              {filteredIntegrations.length} available
            </span>
          )}
        </div>

        {filteredIntegrations.length === 0 ? (
          <div className="p-48 border border-dashed border-mist text-center space-y-8 rounded bg-soft-snow/35">
            <Plug className="size-32 text-slate/40 mx-auto" />
            <p className="text-slate text-sm">
              No integrations match your filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
              }}
              className="text-xs font-mono uppercase text-iris-violet hover:underline pt-8"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
            {filteredIntegrations.map((meta) => {
              const isConnected = connectors.some(
                (c) => c.connectorType === meta.type
              );
              const isConnecting = connectingType === meta.type;

              return (
                <div
                  key={meta.type}
                  className={`flex flex-col justify-between p-24 rounded border transition-all ${
                    isConnected
                      ? "border-iris-violet/20 bg-iris-violet/[0.02] shadow-xs"
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
                          <h3 className="font-semibold text-graphite-ink text-sm tracking-tight">
                            {meta.name}
                          </h3>
                          <span className="text-[9px] uppercase font-mono tracking-wider text-slate/60 block mt-[2px]">
                            {meta.mcpUrl}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      {isConnected ? (
                        <span className="flex items-center gap-[3px] text-[9px] uppercase font-mono tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-[6px] py-[2px] rounded select-none">
                          <Check className="size-[10px]" />
                          Connected
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase font-mono tracking-wider text-iris-violet bg-iris-violet/5 border border-iris-violet/10 px-[6px] py-[2px] rounded select-none">
                          OAuth Ready
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate leading-relaxed min-h-36">
                      {meta.description}
                    </p>

                    {/* Capabilities */}
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

                    {/* Write operations note */}
                    <div className="flex items-start gap-[6px] text-[10px] text-slate/70 leading-relaxed">
                      <ShieldCheck className="size-[12px] text-iris-violet/50 mt-[2px] shrink-0" />
                      <span>
                        Write operations ({meta.writeExamples.join(", ")}) require approval via the Approver subagent.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-16 border-t border-mist mt-24 shrink-0">
                    {isConnected ? (
                      <div className="flex items-center gap-[6px] text-[10px] font-mono text-emerald-600">
                        <Check className="size-[12px]" />
                        <span className="uppercase tracking-wider">
                          Active · MCP
                        </span>
                      </div>
                    ) : (
                      <button
                        disabled={!isAdminOrOwner || isConnecting}
                        onClick={() => handleConnect(meta)}
                        className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[10px] uppercase tracking-wider px-[12px] py-[8px] flex items-center gap-[6px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="size-[12px] animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="size-[10px]" />
                            Connect with {meta.name}
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
    </div>
  );
}
