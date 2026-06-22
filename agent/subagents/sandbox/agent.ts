import { defineAgent } from "eve";
import { createVertex } from "@ai-sdk/google-vertex";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
});

export default defineAgent({
  description: "Execute diagnostics and scripts in a secure sandbox to verify system state or reproduce issues.",
  model: vertex("gemini-3.5-flash"),
});
