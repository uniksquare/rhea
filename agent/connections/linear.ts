import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/sse",
  description:
    "Linear project management. Search and retrieve issues by identifier " +
    "or query, list projects and active cycles, create new issues linked " +
    "to incidents, update issue status and priority, add comments for " +
    "investigation updates, and track team workload across assignees.",
  auth: connect(process.env.VERCEL_CONNECT_LINEAR_ID || "linear/rhea-bloop"),
  approval: once(),
});
