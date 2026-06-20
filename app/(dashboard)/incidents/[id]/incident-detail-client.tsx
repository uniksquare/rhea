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
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "HIGH":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "MEDIUM":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "LOW":
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
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
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Top Banner / Navbar */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/incidents">
            <Button variant="ghost" size="sm" className="hover:bg-zinc-800 text-zinc-400 hover:text-white p-2">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityStyles(incident.severity)}`}>
              {incident.severity}
            </span>
            <h2 className="text-sm font-semibold text-white truncate max-w-md">{incident.title}</h2>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-zinc-500">Status:</span>
            {isReadOnly ? (
              <span className="text-zinc-200 text-xs font-semibold px-1">{incident.status}</span>
            ) : (
              <select
                disabled={isUpdatingStatus}
                value={incident.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-transparent border-none text-zinc-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ACTIVE" className="bg-zinc-950 text-red-400">Active</option>
                <option value="INVESTIGATING" className="bg-zinc-950 text-purple-400">Investigating</option>
                <option value="RESOLVED" className="bg-zinc-950 text-emerald-400">Resolved</option>
              </select>
            )}
            {isUpdatingStatus && <Loader2 className="size-3 animate-spin text-zinc-400" />}
          </div>
        </div>
      </header>

      {/* Main Cockpit Split Layout */}
      <div className="flex-1 flex min-h-0 divide-x divide-zinc-800">
        {/* Left Panel: Incident Details & Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Timeline Checklist</h3>
            <div className="grid grid-cols-5 gap-2">
              {timelineSteps.map((step, idx) => (
                <div 
                  key={step.name}
                  className={`p-3 rounded-lg border text-center flex flex-col items-center gap-1.5 transition-all ${
                    step.done
                      ? "bg-purple-950/15 border-purple-800/40 text-purple-200"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-500"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="size-4 text-purple-400" />
                  ) : (
                    <div className="size-4 rounded-full border border-zinc-700 flex items-center justify-center text-[9px] font-bold">
                      {idx + 1}
                    </div>
                  )}
                  <span className="text-[10px] font-semibold truncate w-full">{step.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2 bg-zinc-900/20 border border-zinc-900 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Description</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {incident.description || "No description provided."}
            </p>
          </div>

          {/* Ranked Root Causes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ranked Roots & Analysis</h3>
            {initialRootCauses.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-zinc-800 rounded-lg">
                <p className="text-zinc-500 text-sm">No analysis logged. Ask Rhea in the chat panel to begin investigation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {initialRootCauses.map((cause) => (
                  <div key={cause.cause_id} className="border border-zinc-800 bg-zinc-900/20 p-4 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-200">{cause.category}</span>
                      <span className="text-xs font-bold text-purple-400">{Math.round(cause.confidence * 100)}% Confidence</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{cause.description}</p>
                    <div className="w-full bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-purple-500 h-full rounded-full" 
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
            <div className="space-y-2 bg-zinc-900/20 border border-zinc-900 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Investigation Summary</h3>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                {initialInvestigation.findings}
              </p>
            </div>
          )}

          {/* Remediation Templates */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Available Remediation Templates</h3>
            <div className="space-y-2">
              {fixPatterns.map((pattern) => (
                <div key={pattern.pattern_id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-850 bg-zinc-900/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-zinc-200">{pattern.cause_category}</span>
                    <span className="text-[10px] text-zinc-500">Success rate: {Math.round(pattern.success_rate * 100)}%</span>
                  </div>
                  <Badge variant="secondary" className="bg-zinc-800 border-zinc-700 text-zinc-400 text-[10px]">
                    Executable Template
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Incident Scoped Agent Chat */}
        <div className="w-[450px] shrink-0 flex flex-col min-h-0 bg-zinc-950">
          <header className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0 bg-zinc-900/10">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rhea Investigation Chat</span>
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${isBusy ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[10px] font-semibold text-zinc-500 capitalize">{agent.status}</span>
            </div>
          </header>

          {/* Chat message thread */}
          <div className="flex-1 min-h-0 flex flex-col">
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                <div className="p-3 bg-purple-600/10 rounded-full border border-purple-500/20 text-purple-400">
                  <AlertTriangle className="size-6" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="text-sm font-semibold text-white">Start Rhea Investigation</p>
                  <p className="text-xs text-zinc-500">
                    Ask Rhea to look into this incident. She will inspect servers, query logs, and identify causes.
                  </p>
                </div>
                <Button 
                  onClick={() => agent.send({ message: "Investigate this incident." })}
                  disabled={isBusy}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 shadow-lg shadow-purple-500/10"
                >
                  {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Auto-Investigate
                </Button>
              </div>
            ) : (
              <Conversation className="min-h-0 flex-1">
                <ConversationContent className="px-4 py-4 gap-4">
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
                      <MessageContent className="flex items-center gap-2 text-zinc-500">
                        <Loader2 className="size-3.5 animate-spin text-purple-400" />
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
              <div className="px-4 pt-2">
                <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400 leading-relaxed">
                  Request failed: {agent.error.message}
                </div>
              </div>
            )}

            {/* Input Composer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/10 shrink-0">
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
