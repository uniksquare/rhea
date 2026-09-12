import { defineAgent } from "eve";
import { model, modelOptions, compaction, modelContextWindowTokens } from "./model";

// Suppress Vercel AI SDK thoughtSignature warning logs
// @ts-ignore
globalThis.AI_SDK_LOG_WARNINGS = false;

export default defineAgent({
  model,
  ...(modelOptions ? { modelOptions } : {}),
  ...(compaction ? { compaction } : {}),
  ...(modelContextWindowTokens ? { modelContextWindowTokens } : {}),
});
