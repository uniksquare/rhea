import { AgentChat } from "@/app/_components/agent-chat";

export default function ChatPage() {
  return (
    <div className="absolute inset-0 flex flex-col bg-paper-white">
      <AgentChat />
    </div>
  );
}
