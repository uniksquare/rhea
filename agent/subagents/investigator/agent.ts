import { defineAgent } from "eve";
import { createVertex } from "@ai-sdk/google-vertex";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
});

export default defineAgent({
  description: "Query logs, metrics, and cloud state to isolate the root cause of an incident.",
  model: vertex("gemini-3.5-flash"),
});
