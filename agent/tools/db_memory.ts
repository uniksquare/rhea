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
  async execute(input) {
    try {
      switch (input.action) {
        case "get_similar_incidents": {
          let query = `
            SELECT i.incident_id, i.title, i.description, i.severity, i.status, i.created_at, inv.findings
            FROM incidents i
            LEFT JOIN investigations inv ON i.incident_id = inv.incident_id
          `;
          const params: any[] = [];
          
          if (input.keyword) {
            query += " WHERE i.title ILIKE $1 OR i.description ILIKE $1 OR inv.findings ILIKE $1";
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
             WHERE cause_category = $1
             ORDER BY success_rate DESC, created_at DESC LIMIT 5;`,
            [input.category]
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
