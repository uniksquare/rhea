"use client";

import { useState, useEffect, useRef } from "react";
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
import { Google } from "@lobehub/icons";

const LOGO_DEV_PUBLIC_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || 'pk_DVzJORPoQumYH3A-U6iG2g';

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

// Custom Starburst/Sparkle Icon for Logo
function StarburstIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="currentColor" />
    </svg>
  );
}

export function AgentChat({ chatId }: { chatId: string | null }) {
  const [initialSession, setInitialSession] = useState<any>(undefined);
  const [loading, setLoading] = useState(!!chatId);

  useEffect(() => {
    if (!chatId) {
      setInitialSession(undefined);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetch(`/api/chats/${chatId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load chat session");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setInitialSession(data.agent_session_state || undefined);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load chat:", err);
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [chatId]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-paper-white h-full w-full">
        <div className="flex flex-col items-center gap-12 text-slate text-sm font-sans">
          <Loader2 className="size-24 animate-spin text-iris-violet" />
          <span>Retrieving chat session...</span>
        </div>
      </div>
    );
  }

  return <AgentChatInner chatId={chatId} initialSession={initialSession} />;
}

function AgentChatInner({ chatId, initialSession }: { chatId: string | null; initialSession: any }) {
  const [currentChatId, setCurrentChatId] = useState(chatId);
  const isCreatingChatRef = useRef(false);

  const agent = useEveAgent({
    initialSession,
    async onSessionChange(newSessionState) {
      if (currentChatId) {
        try {
          await fetch(`/api/chats/${currentChatId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent_session_state: newSessionState }),
          });
        } catch (err) {
          console.error("Failed to save session state:", err);
        }
      } else if (!isCreatingChatRef.current) {
        isCreatingChatRef.current = true;
        try {
          // Extract user's first message as title
          const firstMessage = agent.data.messages.find((m) => m.role === "user");
          let title = "New Chat";
          if (firstMessage) {
            const textPart = firstMessage.parts.find((p) => p.type === "text");
            if (textPart && "text" in textPart) {
              const text = textPart.text.trim();
              title = text.slice(0, 40) + (text.length > 40 ? "..." : "");
            }
          }

          const res = await fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              agent_session_state: newSessionState,
            }),
          });

          if (res.ok) {
            const newChat = await res.json();
            setCurrentChatId(newChat.chat_id);

            // Update browser URL without triggering React re-mount
            const newUrl = `${window.location.pathname}?id=${newChat.chat_id}`;
            window.history.replaceState(
              { ...window.history.state, as: newUrl, url: newUrl },
              "",
              newUrl
            );

            // Refresh sidebar list
            window.dispatchEvent(new Event("chats-updated"));
          }
        } catch (err) {
          console.error("Failed to auto-create chat in database:", err);
        } finally {
          isCreatingChatRef.current = false;
        }
      }
    },
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  const thinkingStates = ["thinking...", "wandering..."];
  const [thinkingIndex, setThinkingIndex] = useState(0);

  useEffect(() => {
    if (!isBusy) {
      setThinkingIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % thinkingStates.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isBusy, thinkingStates.length]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;

    await agent.send({ message: text });
  };

  const composer = (
    <PromptInput
      onSubmit={handleSubmit}
      className="w-full !h-auto !flex-col !items-stretch bg-iris-violet/15 p-[3px] pt-[26px] rounded-[24px] border !border-iris-violet/15 !ring-0 shadow-[0_0_15px_rgba(116,81,242,0.15)] focus-within:shadow-[0_0_20px_rgba(116,81,242,0.3)] transition-all duration-200 relative"
    >
      {/* Header Model / Status Info */}
      <div className="absolute top-[6px] left-[16px] flex items-center gap-[4px] select-none">
        {isBusy ? (
          <>
            <StarburstIcon className="size-[14px] text-iris-violet animate-spin [animation-duration:3s]" />
            <span className="text-[12px] font-semibold text-iris-violet font-sans leading-none animate-pulse">
              {thinkingStates[thinkingIndex]}
            </span>
          </>
        ) : (
          <>
            <Google.Color size={14} className="rounded-sm" />
            <span className="text-[12px] font-semibold text-iris-violet font-sans leading-none">
              Gemini 3.5 Flash
            </span>
          </>
        )}
      </div>

      {/* Inner White Container */}
      <div className="flex flex-col w-full bg-white rounded-[21px] p-12 gap-8">
        <PromptInputTextarea
          placeholder="Ask Rhea anything..."
          className="w-full bg-transparent resize-none border-0 outline-none placeholder-slate/50 text-graphite-ink font-sans text-[15px] px-8 py-4 field-sizing-content !max-h-[160px] min-h-[48px] focus:ring-0 focus-visible:ring-0 focus-visible:outline-none overflow-hidden"
        />

        <div className="flex items-center justify-end px-8">
          <PromptInputSubmit
            onStop={agent.stop}
            status={agent.status}
            className="!static bg-iris-violet hover:bg-deep-iris text-white rounded-[4px] size-28 flex items-center justify-center p-0 cursor-pointer transition-all hover:scale-[1.03] active:scale-95"
          />
        </div>
      </div>
    </PromptInput>
  );

  return (
    <main className="flex h-full w-full flex-col overflow-hidden bg-paper-white text-graphite-ink font-sans relative">
      {/* Background decoration grid */}
      {isEmpty && <div className="absolute inset-0 dotted-grid-bg opacity-[0.12] pointer-events-none" />}

      {agent.error ? (
        <div className="mx-auto w-full max-w-5xl shrink-0 px-24 pt-16 z-20">
          <div className="flex items-start gap-[12px] rounded-[4px] border border-destructive/20 bg-rose-50/50 p-16 text-sm">
            <AlertCircleIcon className="mt-[2px] size-16 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-graphite-ink">Request failed</p>
              <p className="mt-[4px] text-slate">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-between p-24 sm:p-32 max-w-5xl mx-auto w-full">
        {/* Upper/Welcome Section */}
        {isEmpty ? (
          <div className="w-full flex-1 flex flex-col justify-center pb-[140px] gap-32">
            <div className="flex flex-col gap-24 items-start text-left py-24 select-none w-full animate-in fade-in duration-500">
              <div className="space-y-16">
                <div className="flex items-center gap-12 flex-wrap">
                  <h1 className="font-lustria text-4xl sm:text-5.5xl font-normal tracking-[-2px] text-graphite-ink leading-none">
                    hi I'm rhea
                  </h1>
                  <div className="flex items-center justify-center size-36 sm:size-40 rounded bg-iris-violet text-paper-white shadow-sm select-none animate-pulse">
                    <StarburstIcon className="size-18 sm:size-20" />
                  </div>
                </div>
                <p className="text-slate text-[15px] leading-relaxed max-w-xl">
                  Your autonomous DevOps incident copilot. Ask Rhea to inspect clusters, diagnose errors, or plan hotfixes with rhea subagents.
                </p>

                {/* Square Agent Avatars */}
                <div className="flex items-center gap-8 select-none flex-wrap pt-8">
                  {[
                    { src: "/planner.jpeg", name: "Planner" },
                    { src: "/investigator.jpeg", name: "Investigator" },
                    { src: "/sandbox.jpeg", name: "Sandbox" },
                    { src: "/remediation.jpeg", name: "Remediation" },
                    { src: "/approval.jpeg", name: "Approver" }
                  ].map((avatar, idx) => (
                    <div key={idx} className="relative group hover:scale-[1.03] transition-all duration-200" title={avatar.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar.src}
                        alt={avatar.name}
                        className="size-32 rounded-[4px] border border-mist shadow-xs object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Thread takes the entire top/middle space when not empty */
          <Conversation className="min-h-0 flex-1 bg-paper-white w-full">
            <ConversationContent className="mx-auto w-full max-w-5xl gap-24 px-16 py-24 sm:px-24">
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

        {/* Lower Section (Chat Composer anchored at the bottom) */}
        <div className="w-full pt-16 shrink-0 z-10">
          {composer}
        </div>
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
