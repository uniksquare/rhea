import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Test connectivity to the agent. Returns a pong with the input message.",
  inputSchema: z.object({
    message: z.string().default("ping"),
  }),
  async execute({ message }) {
    return {
      status: "success",
      message: `pong: ${message}`,
      timestamp: new Date().toISOString(),
    };
  },
});
