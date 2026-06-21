import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Middleware uses the edge-safe auth.config.ts (no DB imports)
 * rather than the full auth.ts to avoid pulling pg/dsql into Edge runtime.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|hero.mp4|step1.mp4|step2.mp4|step3.mp4|planner.jpeg|investigator.jpeg|sandbox.jpeg|remediation.jpeg|approval.jpeg|cta.jpeg|footer.jpeg).*)",
  ],
};
