// Formerly a thin wrapper around DynamoDB (Sessions / Executions / ToolCalls /
// AgentTasks). The same helpers now persist to Postgres via Prisma, one row per
// item, with the full document stored in a `data` JSONB column:
//
//   Sessions   -> hook_sessions    (pk session_id)
//   Executions -> hook_executions  (pk execution_id)
//   ToolCalls  -> hook_tool_calls  (pk call_id)
//   AgentTasks -> hook_agent_tasks (pk task_id)
//
// Exported function names and signatures are unchanged so agent/hooks/db-logger.ts
// keeps working as-is. putItem replaces the whole item; updateItem applies a
// DynamoDB-style "SET a = :a, #b = :b" expression as a JSONB merge. Both are
// upserts, matching DynamoDB PutItem / UpdateItem semantics.
import { prisma, sanitizeDbResult } from "./db";

interface TableSpec {
  table: string;
  pk: string;
}

const TABLES: Record<string, TableSpec> = {
  Sessions: { table: "hook_sessions", pk: "session_id" },
  Executions: { table: "hook_executions", pk: "execution_id" },
  ToolCalls: { table: "hook_tool_calls", pk: "call_id" },
  AgentTasks: { table: "hook_agent_tasks", pk: "task_id" },
};

function resolveTable(tableName: string): TableSpec {
  const spec = TABLES[tableName];
  if (!spec) {
    throw new Error(
      `Unknown hook table "${tableName}". Known tables: ${Object.keys(TABLES).join(", ")}`
    );
  }
  return spec;
}

function sanitizeValue(value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (typeof value === "object") {
    const sanitized: any = {};
    for (const key of Object.keys(value)) {
      if (value[key] !== undefined) {
        sanitized[key] = sanitizeValue(value[key]);
      }
    }
    return sanitized;
  }
  return value;
}

function keyValue(spec: TableSpec, key: Record<string, any>): string {
  const value = key[spec.pk];
  if (value === undefined || value === null) {
    throw new Error(`Missing primary key "${spec.pk}" for table ${spec.table}`);
  }
  return String(value);
}

/**
 * Translate a DynamoDB UpdateExpression of the form
 *   "SET #status = :status, completed_at = :completed_at"
 * into a flat patch object. Only SET with simple `path = :value` assignments
 * is supported (that is all the hook logger uses).
 */
function parseUpdateExpression(
  updateExpression: string,
  values: Record<string, any>,
  names?: Record<string, string>
): Record<string, any> {
  const trimmed = updateExpression.trim();
  const match = trimmed.match(/^set\s+([\s\S]+)$/i);
  if (!match) {
    throw new Error(`Unsupported UpdateExpression (only SET is supported): ${updateExpression}`);
  }

  const patch: Record<string, any> = {};
  for (const clause of match[1].split(",")) {
    const parts = clause.split("=");
    if (parts.length !== 2) {
      throw new Error(`Cannot parse assignment "${clause.trim()}" in UpdateExpression`);
    }
    let attr = parts[0].trim();
    const placeholder = parts[1].trim();

    if (attr.startsWith("#")) {
      const resolved = names?.[attr];
      if (!resolved) {
        throw new Error(`ExpressionAttributeNames is missing "${attr}"`);
      }
      attr = resolved;
    }
    if (!placeholder.startsWith(":") || !(placeholder in values)) {
      throw new Error(`ExpressionAttributeValues is missing "${placeholder}"`);
    }
    patch[attr] = values[placeholder];
  }
  return patch;
}

export async function putItem(tableName: string, item: Record<string, any>) {
  const spec = resolveTable(tableName);
  try {
    const doc = sanitizeValue(item);
    const id = keyValue(spec, doc);
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${spec.table} (${spec.pk}, data, created_at, updated_at)
       VALUES ($1, $2::jsonb, NOW(), NOW())
       ON CONFLICT (${spec.pk}) DO UPDATE
         SET data = EXCLUDED.data, updated_at = NOW()`,
      id,
      JSON.stringify(doc)
    );
    return { Attributes: doc };
  } catch (err) {
    console.error(`Error putting item into ${tableName}:`, err);
    throw err;
  }
}

export async function getItem(tableName: string, key: Record<string, any>) {
  const spec = resolveTable(tableName);
  try {
    const id = keyValue(spec, sanitizeValue(key));
    const rows = await prisma.$queryRawUnsafe<{ data: any }[]>(
      `SELECT data FROM ${spec.table} WHERE ${spec.pk} = $1 LIMIT 1`,
      id
    );
    return rows[0] ? sanitizeDbResult(rows[0].data) : undefined;
  } catch (err) {
    console.error(`Error getting item from ${tableName}:`, err);
    throw err;
  }
}

export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
) {
  const spec = resolveTable(tableName);
  try {
    const cleanKey = sanitizeValue(key);
    const id = keyValue(spec, cleanKey);
    const patch = parseUpdateExpression(
      updateExpression,
      sanitizeValue(expressionAttributeValues),
      expressionAttributeNames
    );
    const merged = { ...cleanKey, ...patch };

    const rows = await prisma.$queryRawUnsafe<{ data: any }[]>(
      `INSERT INTO ${spec.table} (${spec.pk}, data, created_at, updated_at)
       VALUES ($1, $2::jsonb, NOW(), NOW())
       ON CONFLICT (${spec.pk}) DO UPDATE
         SET data = ${spec.table}.data || EXCLUDED.data, updated_at = NOW()
       RETURNING data`,
      id,
      JSON.stringify(merged)
    );
    return rows[0] ? sanitizeDbResult(rows[0].data) : merged;
  } catch (err) {
    console.error(`Error updating item in ${tableName}:`, err);
    throw err;
  }
}
