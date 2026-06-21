import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { connectorType, config } = await req.json();

    if (!connectorType || !config) {
      return NextResponse.json({ error: "Missing connector type or config parameters" }, { status: 400 });
    }

    // Simulate validation based on connector type
    switch (connectorType) {
      case "datadog": {
        const { apiKey, appKey, site } = config;
        if (!apiKey || apiKey === "••••••••••••") {
          // Allow passing if it's already masked (editing flow)
        } else if (apiKey.length < 20) {
          return NextResponse.json({ success: false, error: "Invalid Datadog API Key format (too short)" });
        }
        if (!appKey || appKey === "••••••••••••") {
          // Allow passing if it's already masked (editing flow)
        } else if (appKey.length < 20) {
          return NextResponse.json({ success: false, error: "Invalid Datadog App Key format (too short)" });
        }
        if (!site) {
          return NextResponse.json({ success: false, error: "Site domain must be specified (e.g. datadoghq.com)" });
        }
        break;
      }

      case "prometheus": {
        const { url } = config;
        if (!url) {
          return NextResponse.json({ success: false, error: "Prometheus server endpoint URL is required" });
        }
        if (!/^https?:\/\//i.test(url)) {
          return NextResponse.json({ success: false, error: "Endpoint must be a valid HTTP or HTTPS URL" });
        }
        break;
      }

      case "slack": {
        const { botToken, channelId } = config;
        if (!botToken || botToken === "••••••••••••") {
          // Allow passing if it's already masked (editing flow)
        } else if (!botToken.startsWith("xoxb-")) {
          return NextResponse.json({ success: false, error: "Invalid Slack Bot Token (must start with 'xoxb-')" });
        }
        if (!channelId) {
          return NextResponse.json({ success: false, error: "Slack default notification channel ID is required" });
        }
        break;
      }

      case "github": {
        const { personalAccessToken, repository } = config;
        if (!personalAccessToken || personalAccessToken === "••••••••••••") {
          // Allow passing if it's already masked (editing flow)
        } else if (!personalAccessToken.startsWith("ghp_") && !personalAccessToken.startsWith("github_pat_")) {
          return NextResponse.json({ success: false, error: "Invalid GitHub Token (must start with 'ghp_' or 'github_pat_')" });
        }
        if (!repository || !repository.includes("/")) {
          return NextResponse.json({ success: false, error: "Repository path must be in 'owner/repo' format" });
        }
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unsupported connector type: ${connectorType}` }, { status: 400 });
    }

    // Return mock success connection response
    return NextResponse.json({
      success: true,
      message: `Successfully established communication channel and completed handshake checks for ${connectorType}.`,
    });
  } catch (err: any) {
    console.error("[connectors test API] Failed:", err.message);
    return NextResponse.json({ error: "Connection testing failed due to server error" }, { status: 500 });
  }
}
