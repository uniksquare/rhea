import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUsageSummary } from "@/app/(dashboard)/usage/usage-query";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getUsageSummary(session.user.orgId, 30);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("[api/usage] failed:", err?.message || err);
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 });
  }
}
