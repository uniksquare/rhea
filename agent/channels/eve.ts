import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc, type AuthFn } from "eve/channels/auth";
import { auth } from "../../lib/auth";

/**
 * Custom AuthFn that bridges Auth.js sessions into Eve's route auth.
 * Extracts the Auth.js session from the request cookie and maps it
 * to an Eve SessionAuthContext with orgId and role as attributes.
 */
function appSession(): AuthFn<Request> {
  return async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) return null;

      // Eve attributes must be Record<string, string | readonly string[]>
      // Filter out null/undefined values
      const attributes: Record<string, string | readonly string[]> = {};
      if (session.user.orgId) attributes.orgId = session.user.orgId;
      if (session.user.role) attributes.role = session.user.role;
      if (session.user.email) attributes.email = session.user.email;
      if (session.user.name) attributes.name = session.user.name;
      if (session.user.image) attributes.image = session.user.image;

      return {
        authenticator: "authjs",
        principalId: session.user.id,
        principalType: "user",
        attributes,
      };
    } catch {
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
