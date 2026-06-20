import { defineAgent } from "eve";

export default defineAgent({
  description: "Evaluate risk of proposed changes, prompt for human verification, and enforce safety policies.",
  model: "google/gemini-2.5-flash-lite",
});
