import { defineHook } from "eve/hooks";
import { recordUsage } from "../../lib/platform.ts";
import { model, modelProvider } from "../model.ts";

// Eve emits LLM token usage on `step.completed` (one event per model call).
// `turn.completed` carries no usage, so we record per step and let the
// dashboard aggregate. Never throws: usage logging must not break a turn.
export default defineHook({
  events: {
    async "step.completed"(event, ctx) {
      try {
        const usage = event.data?.usage;
        if (!usage) return;

        const orgId = ctx.session.auth.current?.attributes?.orgId;
        if (typeof orgId !== "string" || !orgId) return;

        const inputTokens = Number(usage.inputTokens ?? 0) || 0;
        const outputTokens = Number(usage.outputTokens ?? 0) || 0;
        const cacheReadTokens = Number(usage.cacheReadTokens ?? 0) || 0;
        const cacheWriteTokens = Number(usage.cacheWriteTokens ?? 0) || 0;
        if (!inputTokens && !outputTokens && !cacheReadTokens && !cacheWriteTokens) return;

        const modelId =
          typeof (model as { modelId?: unknown })?.modelId === "string"
            ? (model as { modelId: string }).modelId
            : "unknown";

        await recordUsage({
          orgId,
          assignmentId: undefined,
          taskId: undefined,
          roleKey: ctx.agent?.name || "on-call-engineer",
          tool: "chat",
          provider: modelProvider === "anthropic" ? "anthropic" : "vertex",
          model: modelId,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          costUsd: 0,
        });
      } catch (err) {
        console.error("usage-logger hook error:", err);
      }
    },
  },
});
