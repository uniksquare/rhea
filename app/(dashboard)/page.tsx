import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AgentChat } from "@/app/_components/agent-chat";

export default async function DashboardRootPage() {
  const session = await auth();

  if (!session?.user?.orgId) {
    redirect("/auth/signin");
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-zinc-950">
      <AgentChat />
    </div>
  );
}
