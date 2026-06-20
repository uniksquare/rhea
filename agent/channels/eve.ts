import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc, type AuthFn } from "eve/channels/auth";
import { getToken } from "@auth/core/jwt";

/**
 * Custom AuthFn that bridges Auth.js sessions into Eve's route auth.
 * Extracts the Auth.js session from the request cookie and maps it
 * to an Eve SessionAuthContext with orgId and role as attributes.
 */
function appSession(): AuthFn<Request> {
  return async (request) => {
    try {
      const cookieHeader = request.headers.get("cookie") || "";
      const isSecure = cookieHeader.includes("__Secure-authjs.session-token") || cookieHeader.includes("__Secure-next-auth.session-token");
      const isNextAuth = cookieHeader.includes("next-auth.session-token") || cookieHeader.includes("__Secure-next-auth.session-token");

      const cookieName = isSecure
        ? (isNextAuth ? "__Secure-next-auth.session-token" : "__Secure-authjs.session-token")
        : (isNextAuth ? "next-auth.session-token" : "authjs.session-token");

      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET,
        secureCookie: isSecure,
        cookieName,
      });

      if (!token) return null;

      const principalId = (token.userId || token.sub) as string;
      if (!principalId) return null;

      // Eve attributes must be Record<string, string | readonly string[]>
      const attributes: Record<string, string | readonly string[]> = {};
      if (token.orgId) attributes.orgId = token.orgId as string;
      if (token.role) attributes.role = token.role as string;
      if (token.email) attributes.email = token.email as string;
      if (token.name) attributes.name = token.name as string;
      if (token.picture) attributes.image = token.picture as string;

      return {
        authenticator: "authjs",
        principalId,
        principalType: "user",
        attributes,
      };
    } catch (err) {
      console.error("[appSession] Auth verification failed:", err);
      return null;
    }
  };
}

export default eveChannel({
  auth: [
    appSession(),
    localDev(),
    vercelOidc(),
  ],
});

