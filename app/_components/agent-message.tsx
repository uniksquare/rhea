"use client";

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
  actionText: string;
}> = {
  planner: {
    name: "Planner Subagent",
    color: "text-indigo-500 dark:text-indigo-400",
    bgColor: "bg-indigo-500/5 dark:bg-indigo-400/5",
    borderColor: "border-indigo-500/20 dark:border-indigo-400/25",
    icon: Brain,
    actionText: "Deconstructing objectives and planning execution checklist..."
  },
  investigator: {
    name: "Investigator Subagent",
    color: "text-emerald-500 dark:text-emerald-400",
    bgColor: "bg-emerald-500/5 dark:bg-emerald-400/5",
    borderColor: "border-emerald-500/20 dark:border-emerald-400/25",
    icon: Search,
    actionText: "Analyzing logs, query telemetry, and tracing metrics..."
  },
  sandbox: {
    name: "Sandbox Subagent",
    color: "text-amber-500 dark:text-amber-400",
    bgColor: "bg-amber-500/5 dark:bg-amber-400/5",
    borderColor: "border-amber-500/20 dark:border-amber-400/25",
    icon: Terminal,
    actionText: "Running diagnostic commands inside secure sandbox container..."
  },
  remediation: {
    name: "Remediation Subagent",
    color: "text-rose-500 dark:text-rose-400",
    bgColor: "bg-rose-500/5 dark:bg-rose-400/5",
    borderColor: "border-rose-500/20 dark:border-rose-400/25",
    icon: Sparkles,
    actionText: "Formulating code changes, rollback scripts, and PRs..."
  },
  approver: {
    name: "Approver Subagent",
    color: "text-blue-500 dark:text-blue-400",
    bgColor: "bg-blue-500/5 dark:bg-blue-400/5",
    borderColor: "border-blue-500/20 dark:border-blue-400/25",
    icon: ShieldCheck,
    actionText: "Evaluating risk levels and policy controls for verification..."
  },
  ping: {
    name: "Ping Connectivity Test",
    color: "text-teal-500 dark:text-teal-400",
    bgColor: "bg-teal-500/5 dark:bg-teal-400/5",
    borderColor: "border-teal-500/20 dark:border-teal-400/25",
    icon: Cpu,
    actionText: "Pinging agent core runtime execution harness..."
  },
  db_incident: {
    name: "DSQL Relational Log Writer",
    color: "text-cyan-500 dark:text-cyan-400",
    bgColor: "bg-cyan-500/5 dark:bg-cyan-400/5",
    borderColor: "border-cyan-500/20 dark:border-cyan-400/25",
    icon: Database,
    actionText: "Persisting incident data models directly in Aurora DSQL..."
  },
  db_memory: {
    name: "DSQL Relational Memory Query",
    color: "text-violet-500 dark:text-violet-400",
    bgColor: "bg-violet-500/5 dark:bg-violet-400/5",
    borderColor: "border-violet-500/20 dark:border-violet-400/25",
    icon: Brain,
    actionText: "Retrieving historically matching incident cases and templates..."
  }
};

export function AgentMessage({
  canRespond,
  isStreaming,
  message,
  onInputResponses,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly message: EveMessage;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
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
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function AgentMessagePart({
  canRespond,
  onInputResponses,
  part,
  showCaret,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
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
      const config = subagentsConfig[part.toolName];
      if (config) {
        const Icon = config.icon;
        const isRunning = part.state === "input-available" || part.state === "input-streaming";
        const isCompleted = part.state === "output-available";
        const isFailed = part.state === "output-error" || part.state === "output-denied";
        const isPendingApproval = part.state === "approval-requested";

        return (
          <div className={cn(
            "not-prose mb-4 w-full rounded-lg border p-4 transition-all duration-300 bg-card shadow-sm",
            config.borderColor,
            config.bgColor
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={cn("p-1.5 rounded-md bg-muted/40", config.color)}>
                  {isRunning ? (
                    <Loader2 className={cn("size-4 animate-spin", config.color)} />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
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
                  <div className="text-xs font-mono bg-muted/50 p-2.5 rounded border border-muted max-h-40 overflow-y-auto whitespace-pre-wrap">
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

              {!!part.output && (
                <div className="space-y-1 animate-in fade-in-50 duration-500">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Execution Result
                  </div>
                  <div className="text-xs font-mono bg-muted/30 p-2.5 rounded border border-muted/50 max-h-60 overflow-y-auto whitespace-pre-wrap">
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

