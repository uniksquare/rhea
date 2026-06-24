import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

function getTargetOrigin(): string {
  if (process.env.NODE_ENV === "production") {
    if (process.env.EVE_NEXT_PRODUCTION_ORIGIN) {
      return process.env.EVE_NEXT_PRODUCTION_ORIGIN.replace(/\/$/, "");
    }
    const port = process.env.EVE_NEXT_PRODUCTION_PORT || "4274";
    return `http://127.0.0.1:${port}`;
  }
  
  try {
    const devServerFile = path.join(process.cwd(), ".eve", "dev-server.json");
    if (fs.existsSync(devServerFile)) {
      const config = JSON.parse(fs.readFileSync(devServerFile, "utf-8"));
      return config.url.replace(/\/$/, "");
    }
  } catch (e) {
    console.error("Failed to read dev-server.json:", e);
  }
  
  return "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  const subPath = pathSegments.join("/");
  
  if (subPath !== "health") {
    const session = await auth();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const targetOrigin = getTargetOrigin();
  if (!targetOrigin) {
    return new Response("Eve dev server not running", { status: 503 });
  }

  const url = `${targetOrigin}/eve/v1/${subPath}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: req.signal,
    });

    if (subPath.endsWith("/stream")) {
      const { readable, writable } = new TransformStream();
      if (response.body) {
        response.body.pipeTo(writable).catch((err) => {
          console.error("Stream pipe error:", err);
        });
      }
      return new Response(readable, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err: any) {
    console.error("Error proxying GET to Eve dev server:", err);
    return new Response(err.message, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  const subPath = pathSegments.join("/");

  if (subPath !== "health") {
    const session = await auth();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const targetOrigin = getTargetOrigin();
  if (!targetOrigin) {
    return new Response("Eve dev server not running", { status: 503 });
  }

  const url = `${targetOrigin}/eve/v1/${subPath}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");

  const body = req.body ? req.body : undefined;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      // @ts-ignore
      duplex: "half",
      signal: req.signal,
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err: any) {
    console.error("Error proxying POST to Eve dev server:", err);
    return new Response(err.message, { status: 500 });
  }
}
