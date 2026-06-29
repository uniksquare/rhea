import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { never } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://api.githubcopilot.com/mcp/",
  description:
    "GitHub code platform. Search repositories and code, read file contents " +
    "and directory trees, list and inspect pull requests and issues, view " +
    "commit history, create branches, push commits, and open pull requests " +
    "for incident remediation patches. Requires an active GitHub Copilot " +
    "subscription.",
  auth: connect(process.env.VERCEL_CONNECT_GITHUB_ID || "github/rhea"),
  approval: never(),
});
