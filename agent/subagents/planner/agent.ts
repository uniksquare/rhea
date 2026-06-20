import { defineAgent } from "eve";

export default defineAgent({
  description: "Create structured execution plans for incident investigations and remediations.",
  model: "google/gemini-2.5-flash-lite",
});
