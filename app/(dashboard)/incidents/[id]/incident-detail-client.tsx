"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEveAgent } from "eve/react";
import { 
  ChevronLeft, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  Play, 
  ArrowRight,
  RefreshCw,
  Send,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { AgentMessage } from "@/app/_components/agent-message";
import { Message, MessageContent } from "@/components/ai-elements/message";

interface UserInfo {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

interface IncidentDetailClientProps {
  initialIncident: any;
  initialInvestigation: any;
  initialRootCauses: any[];
  fixPatterns: any[];
  user: UserInfo;
}

export function IncidentDetailClient({
  initialIncident,
  initialInvestigation,
  initialRootCauses,
  fixPatterns,
  user
}: IncidentDetailClientProps) {
  const router = useRouter();
  const [incident, setIncident] = useState(initialIncident);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const isReadOnly = user.role === "VIEWER";

  // 1. Initialize Eve Agent Hook with Persistent DB Session
  const agent = useEveAgent({
    initialSession: incident.agent_session_state || undefined,
    async onSessionChange(newSessionState) {
      try {
        await fetch(`/api/incidents/${incident.incident_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_session_state: newSessionState }),
        });
      } catch (err) {
        console.error("Failed to persist agent session state:", err);
      }
    },
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        incidentId: incident.incident_id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
      },
    }),
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  // 2. Handle Status Update
  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/incidents/${incident.incident_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      const updated = await res.json();
      setIncident(updated);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update incident status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 3. Handle Send Chat Message
  const handleSubmitMessage = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;
    await agent.send({ message: text });
  };

  const getSeverityStyles = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "MEDIUM":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "LOW":
        return "bg-slate/5 text-slate border-slate/15";
      default:
        return "bg-slate/5 text-slate border-slate/15";
    }
  };

  // Timeline checklist calculator
  const timelineSteps = [
    { name: "Triggered", done: true },
    { name: "Investigating", done: !!initialInvestigation || incident.status === "INVESTIGATING" || incident.status === "RESOLVED" },
    { name: "Root Cause Identified", done: initialRootCauses.length > 0 || incident.status === "RESOLVED" },
    { name: "Remediation Proposed", done: fixPatterns.length > 0 || incident.status === "RESOLVED" },
    { name: "Resolved", done: incident.status === "RESOLVED" }
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-paper-white text-graphite-ink rounded border border-mist overflow-hidden shadow-sm">
      {/* Top Banner / Navbar */}
      <header className="h-[64px] flex items-center justify-between px-[24px] border-b border-mist bg-soft-snow shrink-0">
        <div className="flex items-center gap-[12px]">
          <Link href="/incidents">
            <button className="hover:bg-paper-white border border-transparent hover:border-mist text-slate hover:text-graphite-ink p-[8px] rounded transition-all cursor-pointer">
              <ChevronLeft className="size-[16px]" />
            </button>
          </Link>
          <div className="flex items-center gap-[12px]">
            <span className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${getSeverityStyles(incident.severity)}`}>
              {incident.severity}
            </span>
            <h2 className="font-lustria text-sm font-semibold text-graphite-ink truncate max-w-md">{incident.title}</h2>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-[12px]">
          <div className="flex items-center gap-[6px] bg-paper-white border border-mist rounded px-[12px] py-[6px]">
            <span className="text-xs text-slate">Status:</span>
            {isReadOnly ? (
              <span className="text-graphite-ink text-xs font-semibold px-1">{incident.status}</span>
            ) : (
              <select
                disabled={isUpdatingStatus}
                value={incident.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-transparent border-none text-graphite-ink text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ACTIVE" className="bg-paper-white text-rose-600 font-semibold">Active</option>
                <option value="INVESTIGATING" className="bg-paper-white text-iris-violet font-semibold">Investigating</option>
                <option value="RESOLVED" className="bg-paper-white text-emerald-600 font-semibold">Resolved</option>
              </select>
            )}
            {isUpdatingStatus && <Loader2 className="size-[12px] animate-spin text-slate" />}
          </div>
        </div>
      </header>

      {/* Main Cockpit Split Layout */}
      <div className="flex-1 flex min-h-0 divide-x divide-mist">
        {/* Left Panel: Incident Details & Timeline */}
        <div className="flex-1 overflow-y-auto p-24 space-y-24">
          {/* Timeline */}
          <div className="space-y-[12px]">
            <h3 className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Timeline Checklist</h3>
            <div className="grid grid-cols-5 gap-[8px]">
              {timelineSteps.map((step, idx) => (
                <div 
                  key={step.name}
                  className={`p-[12px] rounded border text-center flex flex-col items-center gap-[6px] transition-all ${
                    step.done
                      ? "bg-iris-violet/5 border-iris-violet/20 text-iris-violet"
                      : "bg-soft-snow border-mist text-slate"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="size-[16px] text-iris-violet" />
                  ) : (
                    <div className="size-[16px] rounded-full border border-mist flex items-center justify-center text-[9px] font-mono font-bold">
                      {idx + 1}
                    </div>
                  )}
                  <span className="text-[9px] font-mono uppercase tracking-wider truncate w-full">{step.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-[8px] bg-soft-snow border border-mist rounded p-16">
            <h3 className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Description</h3>
            <p className="text-sm text-graphite-ink leading-relaxed">
              {incident.description || "No description provided."}
            </p>
          </div>

          {/* Ranked Root Causes */}
          <div className="space-y-[12px]">
            <h3 className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Ranked Roots & Analysis</h3>
            {initialRootCauses.length === 0 ? (
              <div className="p-24 text-center border border-dashed border-mist rounded bg-soft-snow/30">
                <p className="text-slate text-sm">No analysis logged. Ask Rhea in the chat panel to begin investigation.</p>
              </div>
            ) : (
              <div className="space-y-[12px]">
                {initialRootCauses.map((cause) => (
                  <div key={cause.cause_id} className="border border-mist bg-soft-snow p-16 rounded space-y-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-graphite-ink">{cause.category}</span>
                      <span className="text-xs font-mono font-bold text-iris-violet">{Math.round(cause.confidence * 100)}% Confidence</span>
                    </div>
                    <p className="text-xs text-slate leading-relaxed">{cause.description}</p>
                    <div className="w-full bg-mist h-[6px] rounded-full overflow-hidden">
                      <div 
                        className="bg-iris-violet h-full rounded-full" 
                        style={{ width: `${cause.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Findings */}
          {initialInvestigation?.findings && (
            <div className="space-y-[8px] bg-soft-snow border border-mist rounded p-16">
              <h3 className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Investigation Summary</h3>
              <p className="text-xs text-slate leading-relaxed whitespace-pre-line">
                {initialInvestigation.findings}
              </p>
            </div>
          )}

          {/* Remediation Templates */}
          <div className="space-y-[12px]">
            <h3 className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Available Remediation Templates</h3>
            <div className="space-y-[8px]">
              {fixPatterns.map((pattern) => (
                <div key={pattern.pattern_id} className="flex items-center justify-between p-[12px] rounded border border-mist bg-soft-snow/50">
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-xs font-semibold text-graphite-ink">{pattern.cause_category}</span>
                    <span className="text-[10px] font-mono text-slate">Success rate: {Math.round(pattern.success_rate * 100)}%</span>
                  </div>
                  <Badge variant="secondary" className="bg-paper-white border border-mist text-slate font-mono text-[9px] uppercase tracking-wider px-[6px] py-[2px] rounded">
                    Executable Template
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Incident Scoped Agent Chat */}
        <div className="w-[450px] shrink-0 flex flex-col min-h-0 bg-paper-white border-l border-mist">
          <header className="h-[48px] border-b border-mist px-16 flex items-center justify-between shrink-0 bg-soft-snow">
            <span className="font-mono text-[10px] font-bold text-slate uppercase tracking-wider">Rhea Investigation Chat</span>
            <div className="flex items-center gap-[6px]">
              <span className={`size-[6px] rounded-full ${isBusy ? 'bg-emerald-500 animate-pulse' : 'bg-slate'}`} />
              <span className="text-[9px] font-mono font-semibold text-slate uppercase tracking-wider">{agent.status}</span>
            </div>
          </header>

          {/* Chat message thread */}
          <div className="flex-1 min-h-0 flex flex-col">
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center p-24 text-center gap-16">
                <div className="p-[12px] bg-iris-violet/5 rounded-full border border-iris-violet/10 text-iris-violet">
                  <AlertTriangle className="size-[24px]" />
                </div>
                <div className="space-y-[4px] max-w-xs">
                  <p className="font-lustria text-sm font-semibold text-graphite-ink">Start Rhea Investigation</p>
                  <p className="text-xs text-slate mt-[4px]">
                    Ask Rhea to look into this incident. She will inspect servers, query logs, and identify causes.
                  </p>
                </div>
                <button 
                  onClick={() => agent.send({ message: "Investigate this incident." })}
                  disabled={isBusy}
                  className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none"
                >
                  {isBusy ? <Loader2 className="size-[14px] animate-spin" /> : <Play className="size-[14px]" />}
                  Auto-Investigate
                </button>
              </div>
            ) : (
              <Conversation className="min-h-0 flex-1 bg-paper-white">
                <ConversationContent className="px-16 py-16 gap-16">
                  {agent.data.messages.map((message, index) => (
                    <AgentMessage
                      canRespond={!isBusy}
                      isStreaming={
                        agent.status === "streaming" && index === agent.data.messages.length - 1
                      }
                      key={message.id}
                      message={message}
                      onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                    />
                  ))}
                  {isBusy && agent.status === "submitted" && (
                    <Message from="assistant" className="animate-pulse">
                      <MessageContent className="flex items-center gap-8 text-slate">
                        <Loader2 className="size-[14px] animate-spin text-iris-violet" />
                        <span className="text-xs">Rhea is thinking...</span>
                      </MessageContent>
                    </Message>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            )}

            {/* Error banner */}
            {agent.error && (
              <div className="px-16 pt-[8px]">
                <div className="p-[10px] rounded border border-rose-100 bg-rose-50/50 text-xs text-rose-600 leading-relaxed">
                  Request failed: {agent.error.message}
                </div>
              </div>
            )}

            {/* Input Composer */}
            <div className="p-16 border-t border-mist bg-soft-snow/30 shrink-0">
              <PromptInput onSubmit={handleSubmitMessage}>
                <PromptInputTextarea 
                  placeholder={isReadOnly ? "Viewing history (read-only)…" : "Ask Rhea to query logs, check pods..."} 
                  disabled={isReadOnly || isBusy}
                />
                <PromptInputSubmit onStop={agent.stop} status={agent.status} disabled={isReadOnly} />
              </PromptInput>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
