import { PrismaClient } from "@prisma/client";
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

// Statements that produce a result set. Leading SQL comments are skipped.
const ROW_RETURNING_RE =
  /^\s*(?:(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*(select|with|show|explain|values|table)\b/i;
const RETURNING_RE = /\breturning\b/i;

/**
 * Drop-in replacement for the old pg-based queryDsql(text, params).
 *
 * Uses $1, $2 ... positional parameters exactly like pg. SELECT-style
 * statements (and anything with RETURNING) go through $queryRawUnsafe and
 * return sanitized rows; INSERT/UPDATE/DELETE/DDL without RETURNING go through
 * $executeRawUnsafe so `rowCount` still reflects the affected row count.
 */
export async function queryDb<Row = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<Row>> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in environment");
  }
  const args = params ?? [];

  if (ROW_RETURNING_RE.test(text) || RETURNING_RE.test(text)) {
    const raw = await prisma.$queryRawUnsafe<Row[]>(text, ...args);
    const rows: Row[] = sanitizeDbResult(raw) ?? [];
    return { rows, rowCount: rows.length };
  }

  const affected = await prisma.$executeRawUnsafe(text, ...args);
  return { rows: [], rowCount: affected };
}
