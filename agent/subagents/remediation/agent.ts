import { defineAgent } from "eve";
import { createVertex } from "@ai-sdk/google-vertex";

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
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

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GEMINI_API_KEY,
  fetch: customFetch,
});

export default defineAgent({
  description: "Generate fixes, rollback scripts, Terraform configs, or draft code/configuration PRs to resolve incidents.",
  model: vertex("gemini-3.5-flash"),
});
