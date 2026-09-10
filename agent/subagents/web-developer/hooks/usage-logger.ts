import { createUsageHook } from "../../../hooks/usage-logger.ts";

// Parent-agent hooks do not fire for subagent turns (see
// node_modules/eve/docs/guides/hooks.md, "Subagent isolation", and
// node_modules/eve/docs/subagents.mdx, which lists Hooks as an
// own-`hooks/`-directory slot). This gives the web-developer subagent its
// own usage-logging hook so its chat/model steps are recorded too.
export default createUsageHook({ roleKey: "web-developer" });
