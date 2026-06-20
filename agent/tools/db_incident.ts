import { defineTool } from "eve/tools";
import { z } from "zod";
import { queryDsql } from "../../lib/dsql.js";

export default defineTool({
  description: "Manage incidents, investigations, and root causes inside the Aurora DSQL relational memory store.",
  inputSchema: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("create_incident"),
      title: z.string().describe("Brief title of the incident"),
      description: z.string().describe("Detailed description of the incident/alert"),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("Severity level"),
    }),
    z.object({
      action: z.literal("update_incident_status"),
      incident_id: z.string().uuid().describe("The UUID of the incident"),
      status: z.enum(["ACTIVE", "RESOLVED"]).describe("New status"),
    }),
    z.object({
      action: z.literal("log_investigation"),
      incident_id: z.string().uuid().describe("The UUID of the incident"),
      findings: z.string().describe("Text findings of the investigation"),
      ranked_causes: z.array(
        z.object({
          category: z.string(),
          confidence: z.number(),
          description: z.string(),
        })
      ).describe("JSON array of identified potential root causes"),
    }),
    z.object({
      action: z.literal("log_fix_pattern"),
      cause_category: z.string().describe("Category of the cause (e.g. DATABASE, DEPLOYMENT, KUBERNETES)"),
      remediation_template: z.string().describe("The command, code or config pattern used to resolve the issue"),
      success_rate: z.number().min(0).max(1).describe("The historical success rate metric"),
    }),
  ]),
  async execute(input) {
    try {
      // 1. Get default organization ID
      const orgRes = await queryDsql("SELECT org_id FROM organizations LIMIT 1;");
      const orgId = orgRes.rows[0]?.org_id;
      if (!orgId) {
        throw new Error("No default organization found. Make sure database is initialized.");
      }

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
             WHERE incident_id = $3
             RETURNING incident_id, status, resolved_at;`,
            [input.status, now, input.incident_id]
          );
          if (res.rowCount === 0) {
            throw new Error(`Incident with ID ${input.incident_id} not found.`);
          }
          return {
            status: "success",
            message: `Incident status updated to ${input.status}`,
            incident: res.rows[0],
          };
        }

        case "log_investigation": {
          // Create investigation entry
          const invRes = await queryDsql(
            `INSERT INTO investigations (incident_id, findings, ranked_causes)
             VALUES ($1, $2, $3)
             RETURNING investigation_id, created_at;`,
            [input.incident_id, input.findings, JSON.stringify(input.ranked_causes)]
          );
          const investigationId = invRes.rows[0].investigation_id;

          // Insert individual root cause entries
          for (const cause of input.ranked_causes) {
            await queryDsql(
              `INSERT INTO root_causes (investigation_id, category, description, confidence)
               VALUES ($1, $2, $3, $4);`,
              [investigationId, cause.category, cause.description, cause.confidence]
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
            `INSERT INTO fix_patterns (cause_category, remediation_template, success_rate)
             VALUES ($1, $2, $3)
             RETURNING pattern_id, cause_category, success_rate;`,
            [input.cause_category, input.remediation_template, input.success_rate]
          );
          return {
            status: "success",
            message: "Remediation fix pattern logged successfully",
            pattern: res.rows[0],
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
