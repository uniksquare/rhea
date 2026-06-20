import { defineAgent } from "eve";

export default defineAgent({
  description: "Execute diagnostics and scripts in a secure sandbox to verify system state or reproduce issues.",
  model: "google/gemini-2.5-flash-lite",
});
