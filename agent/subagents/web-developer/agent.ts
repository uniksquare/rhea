import { defineAgent } from "eve";
import { model, modelOptions, compaction, modelContextWindowTokens } from "../../model";

export default defineAgent({
  description:
    "Edits an assigned website repo: makes changes, deploys a preview, opens a PR, and publishes after sign-off.",
  model,
  ...(modelOptions ? { modelOptions } : {}),
  ...(compaction ? { compaction } : {}),
  ...(modelContextWindowTokens ? { modelContextWindowTokens } : {}),
});
