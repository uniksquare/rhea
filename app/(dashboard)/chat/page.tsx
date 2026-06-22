"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const AgentChat = dynamic(
  () => import("@/app/_components/agent-chat").then((mod) => mod.AgentChat),
  { ssr: false }
);

function ChatContent() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get("id");

  return <AgentChat key={chatId || "new"} chatId={chatId} />;
}

export default function ChatPage() {
  return (
    <div className="absolute inset-0 flex flex-col bg-paper-white">
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center bg-paper-white">
          <div className="flex flex-col items-center gap-12 text-slate text-sm font-sans">
            <svg className="animate-spin size-24 text-iris-violet" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Initializing chat cockpit...</span>
          </div>
        </div>
      }>
        <ChatContent />
      </Suspense>
    </div>
  );
}
