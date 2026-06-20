import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AgentChat } from "@/app/_components/agent-chat";
import { UserNav } from "./_components/user-nav";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <UserNav user={session.user} />
      <AgentChat />
    </div>
  );
}
