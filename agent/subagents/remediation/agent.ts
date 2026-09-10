import { defineAgent } from "eve";
import { model, modelOptions, compaction, modelContextWindowTokens } from "../../model";

export default defineAgent({
  description: "Generate fixes, rollback scripts, Terraform configs, or draft code/configuration PRs to resolve incidents.",
  model,
  ...(modelOptions ? { modelOptions } : {}),
  ...(compaction ? { compaction } : {}),
  ...(modelContextWindowTokens ? { modelContextWindowTokens } : {}),
});
