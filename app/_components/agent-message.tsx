"use client";

import { useReducer, useEffect, useState } from "react";
import { useEveAgent, defaultMessageReducer } from "eve/react";
import type { EveDynamicToolPart, EveMessage, EveMessagePart } from "eve/react";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Google } from "@lobehub/icons";
import {
  Brain,
  Search,
  Terminal,
  ShieldCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Cpu,
  Database
} from "lucide-react";

const LOGO_DEV_PUBLIC_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || 'pk_DVzJORPoQumYH3A-U6iG2g';

function StarburstIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="currentColor" />
    </svg>
  );
}

export type AgentInputResponse = {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
};

const subagentsConfig: Record<string, {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: any;
  image?: string;
  actionText: string;
}> = {
  planner: {
    name: "Planner Subagent",
    color: "text-red-600",
    bgColor: "bg-red-50/50",
    borderColor: "border-red-100",
    icon: Brain,
    image: "/planner.jpeg",
    actionText: "Deconstructing objectives and planning execution checklist..."
  },
  investigator: {
    name: "Investigator Subagent",
    color: "text-amber-600",
    bgColor: "bg-amber-50/50",
    borderColor: "border-amber-100",
    icon: Search,
    image: "/investigator.jpeg",
    actionText: "Analyzing logs, query telemetry, and tracing metrics..."
  },
  sandbox: {
    name: "Sandbox Subagent",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50/50",
    borderColor: "border-emerald-100",
    icon: Terminal,
    image: "/sandbox.jpeg",
    actionText: "Running diagnostic commands inside secure sandbox container..."
  },
  remediation: {
    name: "Remediation Subagent",
    color: "text-violet-600",
    bgColor: "bg-violet-50/50",
    borderColor: "border-violet-100",
    icon: Sparkles,
    image: "/remediation.jpeg",
    actionText: "Formulating code changes, rollback scripts, and PRs..."
  },
  approver: {
    name: "Approver Subagent",
    color: "text-blue-600",
    bgColor: "bg-blue-50/50",
    borderColor: "border-blue-100",
    icon: ShieldCheck,
    image: "/approval.jpeg",
    actionText: "Evaluating risk levels and policy controls for verification..."
  },
  ping: {
    name: "Ping Connectivity Test",
    color: "text-teal-600",
    bgColor: "bg-teal-50/50",
    borderColor: "border-teal-100",
    icon: Cpu,
    actionText: "Pinging agent core runtime execution harness..."
  },
  db_incident: {
    name: "DSQL Relational Log Writer",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50/50",
    borderColor: "border-cyan-100",
    icon: Database,
    actionText: "Persisting incident data models directly in Aurora DSQL..."
  },
  db_memory: {
    name: "DSQL Relational Memory Query",
    color: "text-violet-600",
    bgColor: "bg-violet-50/50",
    borderColor: "border-violet-100",
    icon: Brain,
    actionText: "Retrieving historically matching incident cases and templates..."
  },
  github_connector: {
    name: "GitHub PR Creator",
    color: "text-orange-600",
    bgColor: "bg-orange-50/50",
    borderColor: "border-orange-100",
    icon: Sparkles,
    actionText: "Drafting remediation Pull Request on GitHub repository..."
  },
  slack_connector: {
    name: "Slack Alert Integrator",
    color: "text-pink-600",
    bgColor: "bg-pink-50/50",
    borderColor: "border-pink-100",
    icon: ShieldCheck,
    actionText: "Publishing Slack alerts and approval updates..."
  },
  eventbridge_publisher: {
    name: "AWS EventBridge Event Bus",
    color: "text-amber-600",
    bgColor: "bg-amber-50/50",
    borderColor: "border-amber-100",
    icon: Cpu,
    actionText: "Publishing lifecycle state checkpoints to AWS EventBridge..."
  },
  aws_connectors: {
    name: "AWS CloudWatch & EKS State",
    color: "text-teal-600",
    bgColor: "bg-teal-50/50",
    borderColor: "border-teal-100",
    icon: Search,
    actionText: "Retrieving application logs and cluster metrics..."
  }
};

export function AgentMessage({
  canRespond,
  isStreaming,
  message,
  onInputResponses,
  events,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly message: EveMessage;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly events?: readonly any[];
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  return (
    <Message
      data-optimistic={message.metadata?.optimistic ? "true" : undefined}
      from={message.role}
    >
      <MessageContent>
        {message.parts.map((part, index) => (
          <AgentMessagePart
            canRespond={canRespond}
            key={partKey(part, index)}
            onInputResponses={onInputResponses}
            part={part}
            showCaret={isStreaming && message.role === "assistant" && index === lastTextIndex}
            events={events}
          />
        ))}
        {!isStreaming && message.role === "assistant" && (
          <div className="flex items-center gap-[4px] mt-8 select-none text-[10px] font-medium text-slate/50">
            <StarburstIcon className="size-[12px] text-iris-violet opacity-40" />
            <span className="font-sans leading-none">Rhea</span>
            <span className="text-slate/30 leading-none">•</span>
            <Google.Color size={12} className="opacity-40 grayscale" />
            <span className="font-sans leading-none">Gemini 3.5 Flash</span>
          </div>
        )}
      </MessageContent>
    </Message>
  );
}

function SubagentProgress({ childSessionId }: { childSessionId: string }) {
  const msgReducer = defaultMessageReducer();
  const [state, dispatch] = useReducer(msgReducer.reduce, null, () => msgReducer.initial());
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!childSessionId) return;

    let active = true;
    const abortController = new AbortController();
    setIsStreaming(true);

    async function startStream() {
      try {
        const res = await fetch(`/eve/v1/session/${childSessionId}/stream`, {
          signal: abortController.signal,
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch subagent stream: ${res.statusText}`);
        }
        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (active) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim() && active) {
                try {
                  const event = JSON.parse(line);
                  dispatch(event);
                  
                  if (event.type === "session.completed" || event.type === "session.failed") {
                    setIsStreaming(false);
                  }
                } catch (e) {
                  console.error("Failed to parse subagent event line:", e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Subagent stream error:", err);
        }
      } finally {
        if (active) {
          setIsStreaming(false);
        }
      }
    }

    startStream();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [childSessionId]);

  const messages = state.messages || [];

  return (
    <div className="mt-3 bg-muted/20 border border-muted/50 rounded-lg p-3 space-y-3 pl-4 border-l-2 border-l-iris-violet/50 ml-1.5 animate-in fade-in duration-300">
      <div className="text-[10px] font-bold text-slate/60 uppercase tracking-wider flex items-center gap-2">
        <Sparkles className="size-3 text-iris-violet" />
        <span>Subagent Internal Execution Log</span>
      </div>
      {messages.length === 0 && isStreaming && (
        <span className="text-xs text-slate/50 italic">Waiting for subagent stream...</span>
      )}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {messages.map((message) => {
          if (message.role === "user") return null;

          return (
            <div key={message.id} className="space-y-2">
              {message.parts.map((part, index) => {
                if (part.type === "reasoning") {
                  return (
                    <div key={index} className="mb-2">
                      <Reasoning
                        defaultOpen={true}
                        isStreaming={part.state === "streaming"}
                      >
                        <ReasoningTrigger className="!text-[11px] !py-1 !px-2" />
                        <ReasoningContent className="!text-xs !p-2 !mt-2">
                          {part.text}
                        </ReasoningContent>
                      </Reasoning>
                    </div>
                  );
                }
                if (part.type === "text") {
                  return (
                    <div key={index} className="text-xs text-graphite-ink whitespace-pre-wrap leading-relaxed">
                      {part.text}
                    </div>
                  );
                }
                if (part.type === "dynamic-tool") {
                  const rawName = part.toolName;
                  const toolKey = rawName.startsWith("eve:subagent:")
                    ? rawName.slice("eve:subagent:".length)
                    : rawName;
                  const config = subagentsConfig[toolKey];
                  const displayName = config?.name || rawName;

                  const isCompleted = part.state === "output-available";
                  const isFailed = part.state === "output-error" || part.state === "output-denied";

                  return (
                    <div key={index} className="text-[11px] font-mono text-slate bg-muted/50 px-2 py-1 rounded border border-muted flex items-center gap-2 max-w-fit">
                      {isCompleted ? (
                        <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                      ) : isFailed ? (
                        <XCircle className="size-3 text-destructive shrink-0" />
                      ) : (
                        <Loader2 className="size-3 animate-spin text-iris-violet shrink-0" />
                      )}
                      <span>
                        {isCompleted ? "Completed" : isFailed ? "Failed" : "Running"} tool: <strong>{displayName}</strong>
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          );
        })}
      </div>
      {isStreaming && (
        <div className="flex items-center gap-2 text-[10px] text-slate/60 animate-pulse">
          <Loader2 className="size-3 animate-spin text-iris-violet animate-spin [animation-duration:3s]" />
          <span>Subagent executing...</span>
        </div>
      )}
    </div>
  );
}

function AgentMessagePart({
  canRespond,
  onInputResponses,
  part,
  showCaret,
  events,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
  readonly events?: readonly any[];
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      return (
        <MessageResponse caret="block" isAnimating={showCaret}>
          {part.text}
        </MessageResponse>
      );
    case "reasoning":
      return (
        <Reasoning defaultOpen isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    case "dynamic-tool": {
      const toolKey = part.toolName.startsWith("eve:subagent:")
        ? part.toolName.slice("eve:subagent:".length)
        : part.toolName;
      const config = subagentsConfig[toolKey];
      if (config) {
        const Icon = config.icon;
        const isRunning = part.state === "input-available" || part.state === "input-streaming";
        const isCompleted = part.state === "output-available";
        const isFailed = part.state === "output-error" || part.state === "output-denied";
        const isPendingApproval = part.state === "approval-requested";

        const childSessionId = events?.find(
          (ev) => ev.type === "subagent.called" && ev.data.callId === part.toolCallId
        )?.data.childSessionId;

        return (
          <div className={cn(
            "not-prose mb-4 w-full rounded-lg border p-4 transition-all duration-300 bg-card shadow-sm",
            config.borderColor,
            config.bgColor
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {config.image ? (
                  <div className="shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.image}
                      alt={config.name}
                      className="size-28 rounded-[4px] border border-mist shadow-xs object-cover"
                    />
                    {isRunning && (
                      <div className="absolute -bottom-[3px] -right-[3px] bg-white rounded-full border border-mist shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center size-[14px] z-10">
                        <Loader2 className="size-[10px] animate-spin text-iris-violet" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={cn("p-1.5 rounded-md bg-muted/40", config.color)}>
                    {isRunning ? (
                      <Loader2 className={cn("size-4 animate-spin", config.color)} />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{config.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {isRunning ? config.actionText : isCompleted ? "Task completed successfully." : isFailed ? "Task run failed." : isPendingApproval ? "Awaiting human-in-the-loop review." : "Subagent status: " + part.state}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isCompleted && <CheckCircle2 className="size-4 text-emerald-500" />}
                {isFailed && <XCircle className="size-4 text-destructive" />}
                {isPendingApproval && <Loader2 className="size-4 animate-spin text-yellow-500" />}
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                  {part.state.replace("-", " ")}
                </span>
              </div>
            </div>

            <div className="mt-3.5 space-y-3 pl-8 text-sm border-l border-muted/50 ml-3.5">
              {!!part.input && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Arguments / Parameters
                  </div>
                  <div className="text-xs font-mono bg-muted/50 p-2.5 rounded border border-muted max-h-[220px] overflow-y-auto whitespace-pre-wrap">
                    {typeof part.input === 'object' && part.input !== null && 'message' in part.input
                      ? String((part.input as any).message)
                      : JSON.stringify(part.input, null, 2)}
                  </div>
                </div>
              )}

              <InputRequestActions
                canRespond={canRespond}
                part={part}
                onInputResponses={onInputResponses}
              />

              {childSessionId && (
                <SubagentProgress childSessionId={childSessionId} />
              )}

              {!!part.output && (
                <div className="space-y-1 animate-in fade-in-50 duration-500">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Execution Result
                  </div>
                  <div className="text-xs font-mono bg-muted/30 p-2.5 rounded border border-muted/50 max-h-[220px] overflow-y-auto whitespace-pre-wrap">
                    {typeof part.output === 'object'
                      ? JSON.stringify(part.output, null, 2)
                      : String(part.output)}
                  </div>
                </div>
              )}

              {part.errorText && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-destructive uppercase tracking-wider">
                    Error Log
                  </div>
                  <div className="text-xs text-destructive font-mono bg-destructive/5 p-2.5 rounded border border-destructive/15 whitespace-pre-wrap">
                    {part.errorText}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <Tool
          defaultOpen={part.state === "approval-requested" || part.state === "approval-responded"}
        >
          <ToolHeader
            state={part.state}
            title={part.toolName}
            toolName={part.toolName}
            type="dynamic-tool"
          />
          <ToolContent>
            <ToolInput input={part.input} />
            <InputRequestActions
              canRespond={canRespond}
              part={part}
              onInputResponses={onInputResponses}
            />
            <ToolOutput errorText={part.errorText} output={part.output} />
          </ToolContent>
        </Tool>
      );
    }
  }
}

function InputRequestActions({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  if (!inputRequest) {
    return null;
  }

  const inputResponse = part.toolMetadata?.eve?.inputResponse;
  const selectedOption = inputRequest.options?.find(
    (option) => option.id === inputResponse?.optionId,
  );

  return (
    <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
      <p className="text-muted-foreground text-sm">{inputRequest.prompt}</p>
      {inputResponse ? (
        <p className="font-medium text-sm">
          Responded: {selectedOption?.label ?? inputResponse.text ?? inputResponse.optionId}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inputRequest.options?.map((option) => (
            <Button
              disabled={!canRespond}
              key={option.id}
              onClick={() => {
                void onInputResponses([
                  {
                    optionId: option.id,
                    requestId: inputRequest.requestId,
                  },
                ]);
              }}
              size="sm"
              type="button"
              variant={option.style === "danger" ? "destructive" : "default"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function partKey(part: EveMessagePart, index: number): string {
  switch (part.type) {
    case "dynamic-tool":
      return part.toolCallId;
    default:
      return `${part.type}:${index}`;
  }
}

