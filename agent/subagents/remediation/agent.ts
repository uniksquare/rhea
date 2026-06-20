import { defineAgent } from "eve";

export default defineAgent({
  description: "Generate fixes, rollback scripts, Terraform configs, or draft code/configuration PRs to resolve incidents.",
  model: "google/gemini-2.5-flash-lite",
});
