import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.slack.com/sse",
  description:
    "Slack workspace communication. Search messages across channels, read " +
    "channel history and threaded conversations, list available channels, " +
    "post status updates to incident channels, and reply to threads for " +
    "real-time incident coordination and human-in-the-loop approvals.",
  auth: connect("slack"),
  approval: once(),
});
