import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Roles are the global catalog of jobs rhea can do (see docs/naming-and-concepts.md).
// They are not org-scoped, so any authenticated user can read the full catalog.
export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = await prisma.role.findMany({
    select: {
      roleKey: true,
      name: true,
      description: true,
      manifest: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(roles);
}
