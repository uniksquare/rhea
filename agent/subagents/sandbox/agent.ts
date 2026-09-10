import { defineAgent } from "eve";
import { model, modelOptions, compaction, modelContextWindowTokens } from "../../model";

export default defineAgent({
  description: "Execute diagnostics and scripts in a secure sandbox to verify system state or reproduce issues.",
  model,
  ...(modelOptions ? { modelOptions } : {}),
  ...(compaction ? { compaction } : {}),
  ...(modelContextWindowTokens ? { modelContextWindowTokens } : {}),
});
