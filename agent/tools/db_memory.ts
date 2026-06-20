import { defineTool } from "eve/tools";
import { z } from "zod";
import { queryDsql } from "../../lib/dsql.js";

export default defineTool({
  description: "Retrieve past incidents, root causes, and successful remediation patterns from DSQL long-term memory.",
  inputSchema: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("get_similar_incidents"),
      keyword: z.string().optional().describe("Keyword to match in incident title or description"),
    }),
    z.object({
      action: z.literal("get_remediation_patterns"),
      category: z.string().describe("Cause category to retrieve remediation templates for (e.g. DATABASE, DEPLOYMENT)"),
    }),
  ]),
  async execute(input, ctx) {
    try {
      // Extract org_id from the authenticated session
      const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
      let orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
      if (!orgId) {
        // Fallback to default org for non-browser callers
        const orgRes = await queryDsql("SELECT org_id FROM organizations LIMIT 1;");
        orgId = orgRes.rows[0]?.org_id;
        if (!orgId) {
          throw new Error("No organization found. Make sure database is initialized.");
        }
      }

      switch (input.action) {
        case "get_similar_incidents": {
          let query = `
            SELECT i.incident_id, i.title, i.description, i.severity, i.status, i.created_at, inv.findings
            FROM incidents i
            LEFT JOIN investigations inv ON i.incident_id = inv.incident_id
            WHERE i.org_id = $1
          `;
          const params: any[] = [orgId];
          
          if (input.keyword) {
            query += " AND (i.title ILIKE $2 OR i.description ILIKE $2 OR inv.findings ILIKE $2)";
            params.push(`%${input.keyword}%`);
          }
          
          query += " ORDER BY i.created_at DESC LIMIT 5;";
          const res = await queryDsql(query, params);
          
          return {
            status: "success",
            count: res.rowCount,
            incidents: res.rows,
          };
        }

        case "get_remediation_patterns": {
          const res = await queryDsql(
            `SELECT pattern_id, cause_category, remediation_template, success_rate, created_at
             FROM fix_patterns
             WHERE org_id = $1 AND cause_category = $2
             ORDER BY success_rate DESC, created_at DESC LIMIT 5;`,
            [orgId, input.category]
          );
          
          return {
            status: "success",
            count: res.rowCount,
            patterns: res.rows,
          };
        }
      }
    } catch (err: any) {
      return {
        status: "error",
        message: err.message || "An unexpected database error occurred",
      };
    }
  },
});
