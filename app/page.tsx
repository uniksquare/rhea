import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingClient } from "@/components/LandingClient";

export default async function LandingPage() {
  const session = await auth();

  // If already logged in, redirect straight to the Agent Chat dashboard
  if (session?.user?.orgId) {
    redirect("/chat");
  }

  return <LandingClient />;
}

