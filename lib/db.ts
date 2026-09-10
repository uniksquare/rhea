import { PrismaClient } from "@prisma/client";
import pg from "pg";
import dotenv from "dotenv";

// Scripts run outside Next.js (seed-db, init-db, test-db) need .env.local too.
// Next.js already loads it, and dotenv never overrides existing values.
dotenv.config({ path: ".env.local" });

const globalForPrisma = globalThis as unknown as { __rheaPrisma?: PrismaClient };

// Singleton PrismaClient. Cached on globalThis so Next.js dev HMR does not
// open a new connection pool on every reload.
export const prisma: PrismaClient =
  globalForPrisma.__rheaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__rheaPrisma = prisma;
}

// Legacy raw SQL (queryDsql call sites) runs through a pg Pool, not Prisma raw.
// pg sends parameters untyped so Postgres infers uuid/jsonb/etc from context,
// which is what the existing queries were written against. Prisma raw sends
// params as `text` and Postgres refuses to coerce text -> uuid (error 42804).
// Return dates as strings (matches the old type-parser behaviour).
pg.types.setTypeParser(1114, (v) => v);
pg.types.setTypeParser(1184, (v) => v);
pg.types.setTypeParser(1082, (v) => v);

const globalForPg = globalThis as unknown as { __rheaPgPool?: pg.Pool };

function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set in environment");
  }
  const needsSsl = /sslmode=require|neon\.tech/.test(url);
  return new pg.Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

function getPool(): pg.Pool {
  if (!globalForPg.__rheaPgPool) {
    globalForPg.__rheaPgPool = createPool();
  }
  return globalForPg.__rheaPgPool;
}

/**
 * Recursively normalise raw query results so they are plain JSON:
 *   Date   -> ISO string (matches the old pg type-parser intent of returning
 *             dates as strings, and the old sanitizeDbResult behaviour)
 *   BigInt -> number (COUNT(*) etc. come back as bigint from Prisma)
 */
export function sanitizeDbResult(value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER
      ? Number(value)
      : value.toString();
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDbResult);
  }
  if (typeof value === "object") {
    const sanitized: any = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeDbResult(value[key]);
    }
    return sanitized;
  }
  return value;
}

export interface QueryResult<Row = any> {
  rows: Row[];
  rowCount: number;
}

/**
 * Drop-in replacement for the old pg-based queryDsql(text, params).
 *
 * Uses $1, $2 ... positional parameters exactly like pg, through a shared
 * pg Pool, so uuid/jsonb params are inferred by Postgres like before.
 * `rowCount` reflects affected rows for INSERT/UPDATE/DELETE.
 */
export async function queryDb<Row = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<Row>> {
  const res = await getPool().query(text, params ?? []);
  const rows: Row[] = sanitizeDbResult(res.rows) ?? [];
  return { rows, rowCount: res.rowCount ?? rows.length };
}
