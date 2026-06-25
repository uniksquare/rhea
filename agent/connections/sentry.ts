import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.sentry.dev/sse",
  description:
    "Sentry error tracking and performance monitoring. Search issues by " +
    "query, retrieve full stack traces with source-mapped frames, inspect " +
    "breadcrumbs and event context, list projects and releases, and check " +
    "release health metrics across all Sentry organizations the user has " +
    "access to.",
  auth: connect(process.env.VERCEL_CONNECT_SENTRY_ID || "sentry"),
  approval: once(),
});
