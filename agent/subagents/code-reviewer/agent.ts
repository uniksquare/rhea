import { defineAgent } from "eve";
import { model, modelOptions, compaction, modelContextWindowTokens } from "../../model";

export default defineAgent({
  description:
    "Reviews open pull requests on an assigned repo against a rules list and produces a read-only summary; posting review comments requires sign-off.",
  model,
  ...(modelOptions ? { modelOptions } : {}),
  ...(compaction ? { compaction } : {}),
  ...(modelContextWindowTokens ? { modelContextWindowTokens } : {}),
});
