import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.amazonaws.com",
  description:
    "AWS cloud infrastructure. Query CloudWatch logs and metric alarms, " +
    "describe EKS clusters and pod status, inspect EC2 instances and " +
    "target groups, check IAM policies and role trust relationships, " +
    "read CloudTrail API audit events, diagnose Lambda invocation errors, " +
    "and analyze RDS instance performance metrics.",
  auth: connect(process.env.VERCEL_CONNECT_AWS_ID || "aws"),
  approval: once(),
});
