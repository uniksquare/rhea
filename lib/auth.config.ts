import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js configuration.
 * This file is imported by middleware.ts and must NOT contain
 * database adapters or any Node.js-only dependencies.
 *
 * Providers are only registered when their env vars are present, so a
 * missing GitHub/Google OAuth app never crashes boot (e.g. local dev).
 */
const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Public routes that don't require authentication
      const publicPaths = ["/auth/signin", "/auth/error", "/api/auth"];
      const isPublicPath = 
        publicPaths.some((path) => nextUrl.pathname.startsWith(path)) ||
        nextUrl.pathname === "/";

      if (isPublicPath) return true;

      // Allow Eve proxy routes through middleware; we will handle auth inside the route handler
      if (nextUrl.pathname.startsWith("/eve/v1/")) return true;

      // Everything else requires authentication
      return isLoggedIn;
    },
  },
};
