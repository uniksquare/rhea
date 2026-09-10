// Compatibility shim. The app originally talked to Aurora DSQL through this
// module; it now runs on Neon Postgres via Prisma (see lib/db.ts). Every
// existing `import { queryDsql } from "@/lib/dsql"` keeps working unchanged.
export { queryDb as queryDsql, prisma, sanitizeDbResult } from "./db";
export type { QueryResult } from "./db";
