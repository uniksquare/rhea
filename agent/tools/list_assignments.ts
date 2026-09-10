import { defineTool } from "eve/tools";
import { z } from "zod";
import { listAssignments } from "../../lib/platform.ts";

/**
 * Router-level lookup so the root agent can pick the right Assignment before
 * delegating a site change to the `web-developer` subagent.
 *
 * Returns identity fields only. Never returns `config` or `secretsEnc`.
 */
export default defineTool({
  description:
    "List the Assignments (assigned site repos) for the current organization. Returns assignmentId, name, roleKey, and status only. Use this to find the assignmentId to hand to the web-developer subagent for a website/page/content change.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
    if (!orgId) {
      throw new Error("No organization found on the current session.");
    }

    const rows = await listAssignments(orgId);
    return rows.map((a) => ({
      assignmentId: a.assignmentId,
      name: a.name,
      roleKey: a.roleKey,
      status: a.status,
    }));
  },
});
