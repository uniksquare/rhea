import { defineTool } from "eve/tools";
import { z } from "zod";
import { queryDsql } from "../../lib/dsql.ts";

export default defineTool({
  description: "Manage incidents, investigations, and root causes inside the Aurora DSQL relational memory store.",
  inputSchema: z.object({
    action: z.enum([
      "create_incident",
      "update_incident_status",
      "log_investigation",
      "log_fix_pattern"
    ]).describe("The action to perform"),
    title: z.string().optional().describe("Brief title of the incident (required for create_incident)"),
    description: z.string().optional().describe("Detailed description of the incident/alert (required for create_incident)"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().describe("Severity level (required for create_incident)"),
    incident_id: z.string().uuid().optional().describe("The UUID of the incident (required for update_incident_status and log_investigation)"),
    status: z.enum(["ACTIVE", "RESOLVED"]).optional().describe("New status (required for update_incident_status)"),
    findings: z.string().optional().describe("Text findings of the investigation (required for log_investigation)"),
    ranked_causes: z.array(
      z.object({
        category: z.string(),
        confidence: z.number(),
        description: z.string(),
      })
    ).optional().describe("JSON array of identified potential root causes (required for log_investigation)"),
    cause_category: z.string().optional().describe("Category of the cause (required for log_fix_pattern)"),
    remediation_template: z.string().optional().describe("The command, code or config pattern used to resolve the issue (required for log_fix_pattern)"),
    success_rate: z.number().min(0).max(1).optional().describe("The historical success rate metric (required for log_fix_pattern)"),
  }),
  async execute(input, ctx) {
    try {
      // Extract org_id from the authenticated session
      const rawOrgId = ctx.session.auth.current?.attributes?.orgId;
      const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;
      if (!orgId) {
        // Fallback to default org for non-browser callers (e.g. local dev, REPL)
        const orgRes = await queryDsql("SELECT org_id FROM organizations LIMIT 1;");
        const fallbackOrgId = orgRes.rows[0]?.org_id;
        if (!fallbackOrgId) {
          throw new Error("No organization found. Make sure database is initialized.");
        }
        return await executeAction(input, fallbackOrgId);
      }

      return await executeAction(input, orgId);
    } catch (err: any) {
      return {
        status: "error",
        message: err.message || "An unexpected database error occurred",
      };
    }
  },
});

async function executeAction(input: any, orgId: string) {
  switch (input.action) {
    case "create_incident": {
      const res = await queryDsql(
        `INSERT INTO incidents (org_id, title, description, severity, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING incident_id, title, status, created_at;`,
        [orgId, input.title, input.description, input.severity]
      );
      return {
        status: "success",
        message: "Incident created successfully in Aurora DSQL",
        incident: res.rows[0],
      };
    }

    case "update_incident_status": {
      const now = input.status === "RESOLVED" ? new Date() : null;
      const res = await queryDsql(
        `UPDATE incidents
         SET status = $1, resolved_at = $2
         WHERE incident_id = $3 AND org_id = $4
         RETURNING incident_id, status, resolved_at;`,
        [input.status, now, input.incident_id, orgId]
      );
      if (res.rowCount === 0) {
        throw new Error(`Incident with ID ${input.incident_id} not found in your organization.`);
      }
      return {
        status: "success",
        message: `Incident status updated to ${input.status}`,
        incident: res.rows[0],
      };
    }

    case "log_investigation": {
      // Verify the incident belongs to this org
      const check = await queryDsql(
        "SELECT incident_id FROM incidents WHERE incident_id = $1 AND org_id = $2;",
        [input.incident_id, orgId]
      );
      if (check.rowCount === 0) {
        throw new Error(`Incident with ID ${input.incident_id} not found in your organization.`);
      }

      // Create investigation entry
      const invRes = await queryDsql(
        `INSERT INTO investigations (org_id, incident_id, findings, ranked_causes)
         VALUES ($1, $2, $3, $4)
         RETURNING investigation_id, created_at;`,
        [orgId, input.incident_id, input.findings, JSON.stringify(input.ranked_causes)]
      );
      const investigationId = invRes.rows[0].investigation_id;

      // Insert individual root cause entries
      for (const cause of input.ranked_causes) {
        await queryDsql(
          `INSERT INTO root_causes (org_id, investigation_id, category, description, confidence)
           VALUES ($1, $2, $3, $4, $5);`,
          [orgId, investigationId, cause.category, cause.description, cause.confidence]
        );
      }

      return {
        status: "success",
        message: "Investigation and root causes logged successfully",
        investigation_id: investigationId,
      };
    }

    case "log_fix_pattern": {
      const res = await queryDsql(
        `INSERT INTO fix_patterns (org_id, cause_category, remediation_template, success_rate)
         VALUES ($1, $2, $3, $4)
         RETURNING pattern_id, cause_category, success_rate;`,
        [orgId, input.cause_category, input.remediation_template, input.success_rate]
      );
      return {
        status: "success",
        message: "Remediation fix pattern logged successfully",
        pattern: res.rows[0],
      };
    }
  }
}
