import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Query CloudWatch logs and retrieve EKS container/pod metrics for diagnostics.",
  inputSchema: z.object({
    action: z.enum(["query_cloudwatch_logs", "get_eks_state"])
      .describe("The action to perform: query logs ('query_cloudwatch_logs') or check EKS state ('get_eks_state')"),
    log_group: z.string().default("/aws/eks/rhea-cluster/cluster")
      .describe("The log group to query (used for query_cloudwatch_logs)"),
    query: z.string().default("ERROR")
      .describe("Search term or query string like 'database', 'timeout', 'ERROR' (used for query_cloudwatch_logs)"),
    limit: z.number().default(20)
      .describe("Max number of log lines to return (used for query_cloudwatch_logs)"),
    cluster_name: z.string().default("rhea-production")
      .describe("The EKS cluster name (used for get_eks_state)"),
    namespace: z.string().default("default")
      .describe("Kubernetes namespace to check (used for get_eks_state)"),
  }),
  async execute(input) {
    if (input.action === "query_cloudwatch_logs") {
      const q = input.query.toLowerCase();
      const logs: string[] = [];
      const now = new Date();

      if (q.includes("db") || q.includes("database") || q.includes("pool") || q.includes("connection")) {
        logs.push(
          `[${new Date(now.getTime() - 300000).toISOString()}] [ERROR] [db-pool] Connection pool exhausted. Active connections: 100/100, queue_size: 47`,
          `[${new Date(now.getTime() - 280000).toISOString()}] [WARN] [db-pool] Timeout after 5000ms waiting for connection from pool`,
          `[${new Date(now.getTime() - 260000).toISOString()}] [ERROR] [api] pg: connection pool timeout - database: postgres user: admin`,
          `[${new Date(now.getTime() - 240000).toISOString()}] [ERROR] [api] Failed to connect to Aurora DSQL host 'tbt3qdmjvbbfhhuwuu4bxyzcji.dsql.ap-south-1.on.aws': Connection refused`,
          `[${new Date(now.getTime() - 220000).toISOString()}] [FATAL] [api] Database connectivity lost. Initiating service restart...`
        );
      } else if (q.includes("error") || q.includes("500") || q.includes("fail") || q.includes("gateway")) {
        logs.push(
          `[${new Date(now.getTime() - 400000).toISOString()}] [INFO] [ingress] GET /api/v1/deployments - 200 OK (duration: 45ms)`,
          `[${new Date(now.getTime() - 350000).toISOString()}] [ERROR] [ingress] GET /api/v1/incidents - 500 Internal Server Error (duration: 5012ms)`,
          `[${new Date(now.getTime() - 300000).toISOString()}] [ERROR] [ingress] upstream request timeout: gateway failed to respond`,
          `[${new Date(now.getTime() - 250000).toISOString()}] [ERROR] [ingress] GET /api/v1/incidents - 500 Internal Server Error (duration: 5008ms)`,
          `[${new Date(now.getTime() - 200000).toISOString()}] [WARN] [ingress] Circuit breaker tripped for service 'rhea-api-service'`
        );
      } else {
        logs.push(
          `[${new Date(now.getTime() - 600000).toISOString()}] [INFO] [system] Starting container rhea-api-7c4fdf49-2xp8z`,
          `[${new Date(now.getTime() - 580000).toISOString()}] [INFO] [system] Loaded configuration parameters from local settings`,
          `[${new Date(now.getTime() - 550000).toISOString()}] [INFO] [system] Initializing database signers and TLS configs`,
          `[${new Date(now.getTime() - 500000).toISOString()}] [INFO] [system] Server listening on port 3000`
        );
      }

      return {
        status: "success",
        log_group: input.log_group,
        query: input.query,
        count: logs.length,
        logs: logs.slice(0, input.limit).join("\n"),
      };
    } else {
      // EKS state
      return {
        status: "success",
        cluster: input.cluster_name,
        namespace: input.namespace,
        pods: [
          {
            name: "rhea-api-7c4fdf49-2xp8z",
            status: "Running",
            restarts: 5,
            cpu_usage: "92%",
            memory_usage: "880MiB/1024MiB",
            ready: "1/1",
            age: "3h42m",
          },
          {
            name: "rhea-db-proxy-6f8d39c-x291p",
            status: "CrashLoopBackOff",
            restarts: 12,
            cpu_usage: "1%",
            memory_usage: "45MiB/256MiB",
            ready: "0/1",
            age: "24m",
            last_state_terminated_reason: "OOMKilled",
          },
          {
            name: "rhea-worker-3fd8a9b-z1928",
            status: "Running",
            restarts: 0,
            cpu_usage: "12%",
            memory_usage: "310MiB/512MiB",
            ready: "1/1",
            age: "12d",
          }
        ],
        services: [
          {
            name: "rhea-api-service",
            type: "ClusterIP",
            cluster_ip: "10.100.22.41",
            ports: "80/TCP",
            endpoints: "10.0.1.42:3000",
          }
        ]
      };
    }
  },
});
