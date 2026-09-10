import { createVertex } from "@ai-sdk/google-vertex";
import { anthropic } from "@ai-sdk/anthropic";
import { MockLanguageModelV3 } from "ai/test";

// Shared fetch wrapper: strips functionCall.id / functionResponse.id, which
// the Vertex Gemini API rejects on replayed tool calls.
export const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let updatedInit = init;
  if (init?.body && typeof init.body === "string") {
    try {
      const payload = JSON.parse(init.body);
      const sanitize = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach(sanitize);
          return;
        }
        if (obj.functionCall && typeof obj.functionCall === "object") {
          delete obj.functionCall.id;
        }
        if (obj.functionResponse && typeof obj.functionResponse === "object") {
          delete obj.functionResponse.id;
        }
        for (const key in obj) {
          if (typeof obj[key] === "object") {
            sanitize(obj[key]);
          }
        }
      };
      sanitize(payload);
      updatedInit = {
        ...init,
        body: JSON.stringify(payload),
      };
    } catch (e) {
      // Ignore parse errors
    }
  }
  return fetch(input, updatedInit);
};

export type ModelProvider = "anthropic" | "vertex" | "none";

export const modelProvider: ModelProvider = process.env.ANTHROPIC_API_KEY
  ? "anthropic"
  : process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY
    ? "vertex"
    : "none";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
  fetch: customFetch,
});

const noModelConfigured = () => {
  throw new Error("No LLM configured: set ANTHROPIC_API_KEY or GEMINI_API_KEY");
};

// Boot-safe stub: lets the server start without any provider key configured.
// Only throws once a model is actually invoked.
const stubModel = new MockLanguageModelV3({
  doGenerate: noModelConfigured,
  doStream: noModelConfigured,
});

export function getModel(name?: string) {
  switch (modelProvider) {
    case "anthropic":
      return anthropic(name ?? process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5");
    case "vertex":
      return vertex(name ?? "gemini-3.5-flash");
    default:
      return stubModel;
  }
}

export const model = getModel();

// Vertex-only: Gemini thinking config. Anthropic and the boot-safe stub have
// no equivalent, so callers should omit modelOptions entirely in that case.
export const modelOptions =
  modelProvider === "vertex"
    ? {
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: 2048,
            },
          },
        },
      }
    : undefined;

// Eve compiles compaction from the model's context-window metadata; the boot-safe
// stub has none, so only enable compaction when a real LLM is configured.
export const compaction =
  modelProvider === "none" ? undefined : { thresholdPercent: 1 };

// Eve resolves the model's context window from the AI Gateway catalog; the
// boot-safe stub isn't in it, so give Eve an explicit window instead.
export const modelContextWindowTokens =
  modelProvider === "none" ? 200_000 : undefined;
