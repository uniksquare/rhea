import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Publish structured DevOps lifecycle events to AWS EventBridge.",
  inputSchema: z.object({
    event_type: z.enum([
      "InvestigationStarted",
      "HypothesisGenerated",
      "SandboxCreated",
      "RemediationApplied",
      "IncidentResolved"
    ]).describe("The type of event being published"),
    detail: z.record(z.string(), z.any()).describe("JSON payload detail of the event (incident_id, metrics, status)"),
  }),
  async execute({ event_type, detail }) {
    console.log(`[EventBridge Mock] Publishing event '${event_type}' to bus...`);
    
    return {
      status: "success",
      event_id: `evt_${Math.random().toString(36).substring(2, 11)}`,
      event_type,
      detail,
      published_at: new Date().toISOString()
    };
  }
});
