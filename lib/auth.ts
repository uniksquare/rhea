import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { queryDsql } from "./dsql";
import { seedOrg } from "./seed-org";

/**
 * Auth.js v5 type augmentation.
 */
declare module "next-auth" {
  interface User {
    orgId?: string;
    role?: string;
  }
  interface Session {
    user: User & {
      id: string;
      orgId: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    orgId?: string;
    role?: string;
  }
}

/**
 * Providers are defined inline (not imported from auth.config.ts)
 * because Eve's Rolldown bundler can't resolve the split-config
 * import chain. The middleware uses auth.config.ts separately.
 *
 * Each OAuth provider is only registered when its env vars are present,
 * so a missing GitHub/Google OAuth app never crashes boot.
 */
const providers: NonNullable<NextAuthConfig["providers"]> = [];

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

/**
 * Dev-only login bypass: lets the app run locally with no GitHub/Google
 * OAuth apps configured. Only registered when explicitly opted into via
 * AUTH_DEV_BYPASS=true, and never in production.
 */
const isDevBypassEnabled =
  process.env.AUTH_DEV_BYPASS === "true" && process.env.NODE_ENV !== "production";

if (isDevBypassEnabled) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = ((credentials?.email as string) || "").trim();
        if (!email) return null;

        const allowedEmail = (process.env.AUTH_DEV_EMAIL ?? "dev@local.test")
          .trim()
          .toLowerCase();

        if (email.toLowerCase() !== allowedEmail) return null;

        return {
          id: email,
          email,
          name: email.split("@")[0],
        };
      },
    })
  );
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/auth/signin", "/auth/error", "/api/auth"];
      const isPublicPath = publicPaths.some((path) =>
        nextUrl.pathname.startsWith(path)
      );
      if (isPublicPath) return true;
      if (nextUrl.pathname === "/eve/v1/health") return true;
      return isLoggedIn;
    },

    async signIn({ user, account }) {
      if (!user.email) return false;

      try {
        const existing = await queryDsql(
          "SELECT user_id, org_id FROM users WHERE email = $1;",
          [user.email]
        );

        if (existing.rows.length === 0) {
          const orgRes = await queryDsql(
            `INSERT INTO organizations (name) VALUES ($1) RETURNING org_id;`,
            [`${user.name || user.email.split("@")[0]}'s Org`]
          );
          const orgId = orgRes.rows[0].org_id;

          await queryDsql(
            `INSERT INTO users (email, name, role, avatar_url, provider, provider_account_id, org_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [
              user.email,
              user.name || null,
              "OWNER",
              user.image || null,
              account?.provider || "unknown",
              account?.providerAccountId || null,
              orgId,
            ]
          );

          await queryDsql(
            `INSERT INTO org_settings (org_id, settings) VALUES ($1, '{}');`,
            [orgId]
          );

          // Seed mock data for the new organization
          const orgName = `${user.name || user.email.split("@")[0]}'s Org`;
          await seedOrg(orgId, orgName);
        } else {
          await queryDsql(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = $1;",
            [user.email]
          );
        }
      } catch (err) {
        console.error("[auth] Error during sign-in DB sync:", err);
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        try {
          const res = await queryDsql(
            "SELECT user_id, org_id, role, name, avatar_url FROM users WHERE email = $1;",
            [user.email]
          );
          if (res.rows.length > 0) {
            const dbUser = res.rows[0];
            token.userId = dbUser.user_id;
            token.orgId = dbUser.org_id;
            token.role = dbUser.role;
            token.name = dbUser.name || user.name;
            token.picture = dbUser.avatar_url || user.image;
          }
        } catch (err) {
          console.error("[auth] Error fetching user from DB:", err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = (token.userId as string) || "";
        session.user.orgId = (token.orgId as string) || "";
        session.user.role = (token.role as string) || "";
      }
      return session;
    },
  },
});
