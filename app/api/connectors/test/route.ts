import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/connectors/test
 *
 * MCP connectors use OAuth — there are no API keys to validate.
 * This endpoint verifies that the MCP server URL is reachable
 * by performing a lightweight HTTP HEAD/GET request to the endpoint.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { connectorType, mcpUrl } = await req.json();

    if (!connectorType || !mcpUrl) {
      return NextResponse.json(
        { error: "Missing connectorType or mcpUrl" },
        { status: 400 }
      );
    }

    // Attempt to reach the MCP server endpoint
    const targetUrl = mcpUrl.startsWith("http") ? mcpUrl : `https://${mcpUrl}`;

    try {
      const probe = await fetch(targetUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      // MCP servers may return various status codes;
      // a non-network-error response means the server is reachable
      return NextResponse.json({
        success: true,
        message: `MCP server at ${mcpUrl} is reachable (HTTP ${probe.status}).`,
        status: probe.status,
      });
    } catch (fetchErr: any) {
      return NextResponse.json({
        success: false,
        error: `Cannot reach MCP server at ${mcpUrl}: ${fetchErr.message}`,
      });
    }
  } catch (err: any) {
    console.error("[connectors test API] Failed:", err.message);
    return NextResponse.json(
      { error: "Connection testing failed" },
      { status: 500 }
    );
  }
}
