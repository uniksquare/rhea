"use client";

import dynamic from "next/dynamic";

const AgentChat = dynamic(
  () => import("@/app/_components/agent-chat").then((mod) => mod.AgentChat),
  { ssr: false }
);

export default function ChatPage() {
  return (
    <div className="absolute inset-0 flex flex-col bg-paper-white">
      <AgentChat />
    </div>
  );
}
