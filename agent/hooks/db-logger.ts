import { defineHook } from "eve/hooks";
import { putItem, updateItem } from "../../lib/dynamodb.ts";

export default defineHook({
  events: {
    async "*"(event, ctx) {
      try {
        const at = event.meta?.at
          ? new Date(event.meta.at as string | number | Date).toISOString()
          : new Date().toISOString();
        // Extract org_id from authenticated session for tenant scoping
        const orgId = ctx.session.auth.current?.attributes?.orgId || "default";
        
        switch (event.type) {
          case "session.started":
            await putItem("Sessions", {
              session_id: ctx.session.id,
              org_id: orgId,
              created_at: at,
              status: "ACTIVE",
              metadata: event.data || {}
            });
            break;

          case "turn.started":
            await putItem("Executions", {
              execution_id: event.data.turnId,
              session_id: ctx.session.id,
              status: "RUNNING",
              created_at: at,
              sequence: event.data.sequence
            });
            break;

          case "actions.requested":
            for (const act of event.data.actions) {
              const toolName = act.kind === "tool-call"
                ? act.toolName
                : act.kind === "subagent-call"
                ? act.subagentName
                : act.kind === "remote-agent-call"
                ? act.remoteAgentName
                : "load-skill";
              await putItem("ToolCalls", {
                call_id: act.callId,
                session_id: ctx.session.id,
                tool_name: toolName,
                input: act.input || {},
                status: "PENDING",
                created_at: at
              });
            }
            break;

          case "action.result": {
            const res = event.data.result;
            const toolName = res.kind === "tool-result"
              ? res.toolName
              : res.kind === "subagent-result"
              ? res.subagentName
              : res.name || "load-skill";
            const status = event.data.status === "completed" ? "SUCCESS" : "FAILED";
            try {
              await updateItem(
                "ToolCalls",
                { call_id: res.callId },
                "SET #status = :status, #output = :output, errorText = :errorText, completed_at = :completed_at",
                {
                  ":status": status,
                  ":output": res.output || null,
                  ":errorText": event.data.error?.message || null,
                  ":completed_at": at
                },
                {
                  "#status": "status",
                  "#output": "output"
                }
              );
            } catch {
              // Fallback insert if update fails (e.g. actions.requested didn't propagate yet)
              await putItem("ToolCalls", {
                call_id: res.callId,
                session_id: ctx.session.id,
                tool_name: toolName,
                input: {},
                output: res.output || null,
                errorText: event.data.error?.message || null,
                status,
                created_at: at,
                completed_at: at
              });
            }
            break;
          }

          case "subagent.called":
            await putItem("AgentTasks", {
              task_id: event.data.callId,
              parent_id: ctx.session.id,
              name: event.data.name,
              status: "RUNNING",
              assigned_to: event.data.name,
              child_session_id: event.data.childSessionId,
              payload: {
                toolName: event.data.toolName,
                callId: event.data.callId,
                childSessionId: event.data.childSessionId,
              },
              created_at: at
            });
            break;

          case "subagent.completed":
            try {
              await updateItem(
                "AgentTasks",
                { task_id: event.data.callId },
                "SET #status = :status, #result = :result, completed_at = :completed_at",
                {
                  ":status": "COMPLETED",
                  ":result": event.data.output,
                  ":completed_at": at
                },
                {
                  "#status": "status",
                  "#result": "result"
                }
              );
            } catch {
              // Try childSessionId / task_id if callId is not found
              // No-op or log fallback
            }
            break;

          case "turn.completed":
          case "turn.failed": {
            const status = event.type === "turn.completed" ? "COMPLETED" : "FAILED";
            await updateItem(
              "Executions",
              { execution_id: event.data.turnId },
              "SET #status = :status, completed_at = :completed_at",
              {
                ":status": status,
                ":completed_at": at
              },
              {
                "#status": "status"
              }
            );
            break;
          }

          case "session.completed":
          case "session.failed": {
            const status = event.type === "session.completed" ? "COMPLETED" : "FAILED";
            await updateItem(
              "Sessions",
              { session_id: ctx.session.id },
              "SET #status = :status, completed_at = :completed_at",
              {
                ":status": status,
                ":completed_at": at
              },
              {
                "#status": "status"
              }
            );
            break;
          }
        }
      } catch (err) {
        console.error("db-logger hook error:", err);
      }
    }
  }
});
