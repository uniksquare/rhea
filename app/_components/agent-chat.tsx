"use client";

import { useEveAgent } from "eve/react";
import { AlertCircleIcon, Loader2 } from "lucide-react";
import { Message, MessageContent } from "@/components/ai-elements/message";
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
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";

const AGENT_NAME = "rhea";
const BETA_TERMS_HREF = "https://vercel.com/docs/release-phases/public-beta-agreement";

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

// Custom Starburst/Sparkle Icon for Logo
function StarburstIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="currentColor" />
    </svg>
  );
}

export function AgentChat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;

    await agent.send({ message: text });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Send a message…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-paper-white text-graphite-ink font-sans">
      {isEmpty ? null : (
        <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-mist bg-paper-white px-24">
          <span className="flex min-w-0 items-center gap-8">
            <span className="truncate font-lustria font-bold text-sm tracking-tight text-graphite-ink uppercase select-none">{AGENT_NAME}</span>
            <StatusDot status={agent.status} />
          </span>
          <a
            className="rounded border border-cobalt-info/20 px-[8px] py-[3px] font-mono text-[9px] uppercase tracking-wider text-cobalt-info bg-[#e6f0ff]/50 transition-colors hover:bg-[#e6f0ff] leading-none"
            href={BETA_TERMS_HREF}
            rel="noreferrer"
            target="_blank"
          >
            Public preview
          </a>
        </header>
      )}

      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-16 pt-16">
          <div className="flex items-start gap-[12px] rounded border border-destructive/30 bg-destructive/5 p-16 text-sm">
            <AlertCircleIcon className="mt-[2px] size-16 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-graphite-ink">Request failed</p>
              <p className="mt-[4px] text-slate">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1 bg-paper-white">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-24 px-16 py-24 sm:px-24">
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
                  <Loader2 className="size-16 animate-spin text-iris-violet" />
                  <span>Rhea is thinking...</span>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-16 sm:px-24",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-24 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-24",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-24 text-center max-w-md">
            <div className="flex items-center justify-center size-40 rounded bg-iris-violet text-paper-white shadow-sm animate-pulse">
              <StarburstIcon className="size-[24px]" />
            </div>
            <div className="space-y-8">
              <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">rhea cockpit</h1>
              <p className="text-slate text-sm leading-relaxed">
                Autonomous DevOps incident copilot. Ask Rhea to inspect clusters, diagnose errors, or plan hotfixes.
              </p>
            </div>
            <a
              className="rounded border border-cobalt-info/20 px-[12px] py-[4px] font-mono text-[10px] uppercase tracking-wider text-cobalt-info bg-[#e6f0ff]/50 transition-colors hover:bg-[#e6f0ff] leading-none"
              href={BETA_TERMS_HREF}
              rel="noreferrer"
              target="_blank"
            >
              Public preview
            </a>
          </div>
        ) : null}
        <div className="w-full">{composer}</div>
      </div>
    </main>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-slate"
          : "bg-mist";

  return (
    <span className="relative flex size-8">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-8 rounded-full transition-colors", tone)} />
    </span>
  );
}
