import { defineAgent } from "eve";
import { model, modelOptions, compaction, modelContextWindowTokens } from "../../model";

export default defineAgent({
  description: "Query logs, metrics, and cloud state to isolate the root cause of an incident.",
  model,
  ...(modelOptions ? { modelOptions } : {}),
  ...(compaction ? { compaction } : {}),
  ...(modelContextWindowTokens ? { modelContextWindowTokens } : {}),
});
