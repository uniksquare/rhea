import { defineAgent } from "eve";
import { createVertex } from "@ai-sdk/google-vertex";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
});

export default defineAgent({
  description: "Generate fixes, rollback scripts, Terraform configs, or draft code/configuration PRs to resolve incidents.",
  model: vertex("gemini-3.5-flash"),
});
