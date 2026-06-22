import { defineAgent } from "eve";
import { createVertex } from "@ai-sdk/google-vertex";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
});

export default defineAgent({
  description: "Create structured execution plans for incident investigations and remediations.",
  model: vertex("gemini-3.5-flash"),
});
