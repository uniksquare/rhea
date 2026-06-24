import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.pagerduty.com/mcp",
  description:
    "PagerDuty incident management and on-call operations. List and " +
    "retrieve incident details, check current on-call schedules and " +
    "escalation policies, query service health, acknowledge and resolve " +
    "alerts, and inspect recent change events for correlation analysis.",
  auth: connect("pagerduty"),
  approval: once(),
});
