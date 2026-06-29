import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.datadoghq.com/sse",
  description:
    "Datadog observability platform. Query logs with faceted search, " +
    "retrieve APM traces and spans, fetch infrastructure metrics and host " +
    "maps, list active monitors and their alert states, browse dashboard " +
    "definitions, and inspect service-level objectives (SLOs). Requires " +
    "mcp_read permission enabled in the Datadog organization settings.",
  auth: connect(process.env.VERCEL_CONNECT_DATADOG_ID || "datadog"),
  approval: once(),
});
