import { defineAgent } from "eve";
import { createVertex } from "@ai-sdk/google-vertex";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
});

export default defineAgent({
  description: "Evaluate risk of proposed changes, prompt for human verification, and enforce safety policies.",
  model: vertex("gemini-3.5-flash"),
});
