import { defineAgent } from "eve";

export default defineAgent({
  description: "Query logs, metrics, and cloud state to isolate the root cause of an incident.",
  model: "google/gemini-2.5-flash-lite",
});
