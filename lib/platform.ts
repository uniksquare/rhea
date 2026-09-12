/**
 * rhea platform data layer: Assignments, Tasks, and usage accounting.
 *
 * See docs/naming-and-concepts.md for the product <-> engineering vocabulary
 * (Role = capability, Assignment = deployment, Task = run).
 *
 * Tenant isolation: every read and write of an Assignment or Task is scoped by
 * orgId. Callers must pass the orgId from the authenticated session; a row that
 * exists under a different org is treated as not found.
 *
 * Secrets at rest: `assignments.config` never contains credentials. The FTP
 * password (and any extra secrets) are AES-256-GCM encrypted into
 * `assignments.secrets_enc` and only ever decrypted by resolveAssignmentConfig.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { encrypt, decrypt } from "./crypto";
import type { AssignmentConfig, PublishTarget } from "./assignment-types";
import { validateAssignmentConfig } from "./assignment-validate";

export type { AssignmentConfig } from "./assignment-types";

export type TaskStatus =
  | "requested"
  /** A harness turn is in flight; the task is locked (claimed via claimTaskStatus). */
  | "working"
  | "planning"
  | "previewed"
  | "publishing"
  | "published"
  | "discarded"
  | "failed";

/** Max length of the free-text error stored on a Task. */
const TASK_ERROR_MAX = 500;

/** publishTarget as stored in the DB and returned by getAssignment: no `pass`, no `token`. */
export type RedactedPublishTarget = PublishTarget extends infer T
  ? T extends { pass: string }
    ? Omit<T, "pass">
    : Omit<T, "token">
  : never;

/** AssignmentConfig with every secret field removed. Safe to log and return. */
export type RedactedAssignmentConfig = Omit<AssignmentConfig, "publishTarget"> & {
  publishTarget: RedactedPublishTarget;
};

/** Shape of the JSON blob encrypted into assignments.secrets_enc. */
type AssignmentSecrets = {
  /** publishTarget.pass for FTP-style targets. */
  publishPass?: string;
  /** publishTarget.token for Vercel targets. */
  vercelToken?: string;
  [key: string]: unknown;
};

/**
 * Split an incoming config into the redacted config that gets persisted and
 * the secrets that get encrypted. Never mutates the input.
 */
export function splitSecrets(
  config: AssignmentConfig,
  extra?: Record<string, unknown>
): { redacted: RedactedAssignmentConfig; secrets: AssignmentSecrets } {
  const secrets: AssignmentSecrets = { ...(extra ?? {}) };
  const target = config.publishTarget as (PublishTarget & Record<string, unknown>) | undefined | null;
  let redactedTarget: RedactedPublishTarget;
  if (target && typeof target === "object") {
    const rest: Record<string, unknown> = { ...target };
    if (typeof rest.pass === "string") {
      if (rest.pass.length > 0) secrets.publishPass = rest.pass;
      delete rest.pass;
    }
    if (typeof rest.token === "string") {
      if (rest.token.length > 0) secrets.vercelToken = rest.token;
      delete rest.token;
    }
    redactedTarget = rest as RedactedPublishTarget;
  } else {
    redactedTarget = target as unknown as RedactedPublishTarget;
  }
  return {
    redacted: { ...config, publishTarget: redactedTarget },
    secrets,
  };
}

/**
 * Defensive redaction for rows read back from the DB (covers legacy rows that
 * were written before secrets were split out).
 */
function redactConfig(raw: unknown): RedactedAssignmentConfig {
  const config = (raw ?? {}) as AssignmentConfig;
  return splitSecrets(config).redacted;
}

// ── Assignments ──

export async function createAssignment(params: {
  orgId: string;
  roleKey: string;
  name: string;
  config: AssignmentConfig;
  /** Extra secrets to store encrypted alongside publishTarget.pass. */
  secrets?: Record<string, unknown>;
}) {
  const { orgId, roleKey, name, secrets } = params;

  // Throws AssignmentConfigError on a bad workspacePath, siteDir, publish
  // target, etc. Runs before anything is encrypted or persisted.
  const config = validateAssignmentConfig(params.config);

  const split = splitSecrets(config, secrets);
  const hasSecrets = Object.keys(split.secrets).length > 0;
  const secretsEnc = hasSecrets ? encrypt(JSON.stringify(split.secrets)) : undefined;

  const row = await prisma.assignment.create({
    data: {
      orgId,
      roleKey,
      name,
      config: split.redacted as unknown as Prisma.InputJsonValue,
      secretsEnc,
    },
  });
  return stripSecretsEnc(row);
}

type AssignmentRow = Prisma.AssignmentGetPayload<Record<string, never>>;

/** Drop secretsEnc and return a redacted config; the only shape tools ever see. */
function stripSecretsEnc(row: AssignmentRow) {
  const { secretsEnc: _secretsEnc, config, ...rest } = row;
  return { ...rest, config: redactConfig(config) };
}

/**
 * Load an Assignment scoped to orgId. The returned config has all secrets
 * removed; use resolveAssignmentConfig when credentials are actually needed.
 */
export async function getAssignment(id: string, orgId: string) {
  const row = await prisma.assignment.findFirst({
    where: { assignmentId: id, orgId },
  });
  return row ? stripSecretsEnc(row) : null;
}

/**
 * Load an Assignment's config with secrets decrypted and merged back in
 * memory. This is the ONLY function that exposes decrypted secrets; never log
 * or persist its result, and never put it in a tool return value.
 */
export async function resolveAssignmentConfig(
  id: string,
  orgId: string
): Promise<AssignmentConfig> {
  const row = await prisma.assignment.findFirst({
    where: { assignmentId: id, orgId },
  });
  if (!row) throw new Error("Assignment not found");

  const redacted = redactConfig(row.config);

  let secrets: AssignmentSecrets = {};
  if (row.secretsEnc) {
    const plain = decrypt(row.secretsEnc);
    try {
      const parsed = JSON.parse(plain);
      if (parsed && typeof parsed === "object") secrets = parsed as AssignmentSecrets;
    } catch {
      // Legacy rows may have stored a bare string; treat it as the publish pass.
      secrets = { publishPass: plain };
    }
  }

  const target = redacted.publishTarget as RedactedPublishTarget & { type: string };
  const publishTarget: PublishTarget =
    target.type === "hostinger-ftp"
      ? ({ ...target, pass: secrets.publishPass ?? "" } as PublishTarget)
      : target.type === "vercel"
        ? ({ ...target, ...(secrets.vercelToken ? { token: secrets.vercelToken } : {}) } as PublishTarget)
        : (target as PublishTarget);

  return { ...redacted, publishTarget };
}

export async function listAssignments(orgId: string) {
  const rows = await prisma.assignment.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(stripSecretsEnc);
}

/** Max length of a single secret value (matches TASK_ERROR_MAX-scale limits elsewhere). */
const SECRET_VALUE_MAX = 4096;

export class SecretValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretValidationError";
  }
}

/**
 * Merge a patch of secret keys onto an existing secrets object.
 *
 * - A key that is `undefined` in the patch is left untouched.
 * - A key set to `""` (empty string) clears that key (removed from the result).
 * - Any other value must be a string, free of CR/LF/NUL, and at most
 *   SECRET_VALUE_MAX characters; anything else throws SecretValidationError.
 *
 * Pure: never mutates `existing` or `patch`. Returns the merged secrets plus
 * the list of keys that were actually changed (set or cleared).
 */
export function mergeSecrets(
  existing: AssignmentSecrets,
  patch: Record<string, unknown>
): { secrets: AssignmentSecrets; rotatedKeys: string[] } {
  const secrets: AssignmentSecrets = { ...existing };
  const rotatedKeys: string[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;

    if (typeof value !== "string") {
      throw new SecretValidationError(`invalid value for "${key}": must be a string`);
    }
    if (/[\r\n\0]/.test(value)) {
      throw new SecretValidationError(`invalid value for "${key}": control characters are not allowed`);
    }
    if (value.length > SECRET_VALUE_MAX) {
      throw new SecretValidationError(`invalid value for "${key}": exceeds ${SECRET_VALUE_MAX} characters`);
    }

    if (value.length === 0) {
      if (key in secrets) {
        delete secrets[key];
        rotatedKeys.push(key);
      }
    } else {
      secrets[key] = value;
      rotatedKeys.push(key);
    }
  }

  return { secrets, rotatedKeys };
}

/**
 * Rotate (set/clear) encrypted secrets on an Assignment, org-scoped.
 *
 * Loads the row, decrypts any existing secrets, merges in the provided keys
 * via mergeSecrets (undefined keys untouched, "" clears a key), re-encrypts,
 * and bumps updated_at. Never returns the decrypted secrets, only which keys
 * were rotated.
 */
export async function updateAssignmentSecrets(
  id: string,
  orgId: string,
  secrets: { publishPass?: string; vercelToken?: string; [key: string]: unknown }
): Promise<{ assignmentId: string; rotatedKeys: string[] }> {
  const row = await prisma.assignment.findFirst({
    where: { assignmentId: id, orgId },
  });
  if (!row) throw new Error("Assignment not found");

  let existing: AssignmentSecrets = {};
  if (row.secretsEnc) {
    const plain = decrypt(row.secretsEnc);
    try {
      const parsed = JSON.parse(plain);
      if (parsed && typeof parsed === "object") existing = parsed as AssignmentSecrets;
    } catch {
      // Legacy rows may have stored a bare string; treat it as the publish pass.
      existing = { publishPass: plain };
    }
  }

  const { secrets: merged, rotatedKeys } = mergeSecrets(existing, secrets);

  const hasSecrets = Object.keys(merged).length > 0;
  const secretsEnc = hasSecrets ? encrypt(JSON.stringify(merged)) : null;

  await prisma.assignment.update({
    where: { assignmentId: row.assignmentId },
    data: { secretsEnc, updatedAt: new Date() },
  });

  return { assignmentId: row.assignmentId, rotatedKeys };
}

// ── Tasks ──

export async function createTask(params: {
  orgId: string;
  assignmentId: string;
  request: string;
  sessionId?: string;
}) {
  const { orgId, assignmentId, request, sessionId } = params;
  return prisma.task.create({
    data: { orgId, assignmentId, request, sessionId },
  });
}

/** Load a Task scoped to orgId; null when it does not exist under this org. */
export async function getTask(id: string, orgId: string) {
  return prisma.task.findFirst({ where: { taskId: id, orgId } });
}

/**
 * Patch a Task scoped to orgId. Throws "Task not found" when no row matched
 * (wrong id or wrong org). `error` is truncated to 500 chars.
 */
export async function updateTask(
  id: string,
  orgId: string,
  patch: {
    status?: TaskStatus;
    branch?: string;
    previewUrl?: string;
    prUrl?: string;
    publishedUrl?: string;
    error?: string;
    /** Structured plan produced by plan_changes; stored as JSON. */
    plan?: unknown;
    /** Headless harness session id, so a later turn can resume it. */
    sessionId?: string;
  }
) {
  const { status, branch, previewUrl, prUrl, publishedUrl, error, plan, sessionId } = patch;
  const result = await prisma.task.updateMany({
    where: { taskId: id, orgId },
    data: {
      status,
      branch,
      previewUrl,
      prUrl,
      publishedUrl,
      sessionId,
      error: error === undefined ? undefined : error.slice(0, TASK_ERROR_MAX),
      plan: plan === undefined ? undefined : (plan as Prisma.InputJsonValue),
      updatedAt: new Date(),
    },
  });
  if (result.count === 0) throw new Error("Task not found");
  return result;
}

/**
 * Atomic status transition: moves the Task from `from` to `to` in a single
 * conditional update and returns true only when this call made the change.
 * Two workers racing on the same Task get exactly one `true`, so callers can
 * use it as a lock (e.g. previewed -> publishing before a deploy).
 */
export async function claimTaskStatus(
  id: string,
  orgId: string,
  from: TaskStatus,
  to: TaskStatus
): Promise<boolean> {
  const result = await prisma.task.updateMany({
    where: { taskId: id, orgId, status: from },
    data: { status: to, updatedAt: new Date() },
  });
  return result.count === 1;
}

export async function listTasks(orgId: string, assignmentId?: string) {
  return prisma.task.findMany({
    where: { orgId, ...(assignmentId ? { assignmentId } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

// ── Task messages (client-facing chat thread) ──

export type TaskMessageRole = "user" | "assistant" | "system";
export type TaskMessageMode = "plan" | "edit";

/** Max content length stored per message. */
const TASK_MESSAGE_MAX = 20000;

/** Append one turn to a Task's thread. Content is truncated to 20000 chars. */
export async function addTaskMessage(params: {
  orgId: string;
  taskId: string;
  role: TaskMessageRole;
  content: string;
  mode?: TaskMessageMode;
  usage?: unknown;
}) {
  const { orgId, taskId, role, content, mode, usage } = params;
  return prisma.taskMessage.create({
    data: {
      orgId,
      taskId,
      role,
      content: content.slice(0, TASK_MESSAGE_MAX),
      mode,
      usage: usage === undefined ? undefined : (usage as Prisma.InputJsonValue),
    },
  });
}

/** A Task's thread, oldest first, scoped to orgId. */
export async function listTaskMessages(taskId: string, orgId: string) {
  return prisma.taskMessage.findMany({
    where: { taskId, orgId },
    orderBy: { createdAt: "asc" },
  });
}

// ── Usage ledger ──

export type UsageBilling = "api" | "subscription";

export async function recordUsage(params: {
  orgId: string;
  assignmentId?: string;
  taskId?: string;
  roleKey: string;
  tool: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | string | Prisma.Decimal;
  /** "api" (metered) or "subscription" (operator's plan; costUsd is 0). Default "api". */
  billing?: UsageBilling;
}) {
  const {
    orgId,
    assignmentId,
    taskId,
    roleKey,
    tool,
    provider,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costUsd,
    billing,
  } = params;

  return prisma.usageLedger.create({
    data: {
      orgId,
      assignmentId,
      taskId,
      roleKey,
      tool,
      provider,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd: new Prisma.Decimal(costUsd),
      billing: billing ?? "api",
    },
  });
}

/** A single Task's usage ledger rows, oldest first, scoped to orgId. */
export async function getTaskUsage(taskId: string, orgId: string) {
  return prisma.usageLedger.findMany({
    where: { taskId, orgId },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      tool: true,
      provider: true,
      model: true,
      billing: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      costUsd: true,
    },
  });
}
