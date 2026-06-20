import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js configuration.
 * This file is imported by middleware.ts and must NOT contain
 * database adapters or any Node.js-only dependencies.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Public routes that don't require authentication
      const publicPaths = ["/auth/signin", "/auth/error", "/api/auth"];
      const isPublicPath = publicPaths.some((path) =>
        nextUrl.pathname.startsWith(path)
      );

      if (isPublicPath) return true;

      // Eve health endpoint is always public
      if (nextUrl.pathname === "/eve/v1/health") return true;

      // Everything else requires authentication
      return isLoggedIn;
    },
  },
};
