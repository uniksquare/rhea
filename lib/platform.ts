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

export type { AssignmentConfig } from "./assignment-types";

export type TaskStatus =
  | "requested"
  | "planning"
  | "previewed"
  | "published"
  | "discarded"
  | "failed";

/** Max length of the free-text error stored on a Task. */
const TASK_ERROR_MAX = 500;

/** publishTarget as stored in the DB and returned by getAssignment: no `pass`. */
export type RedactedPublishTarget = PublishTarget extends infer T
  ? T extends { pass: string }
    ? Omit<T, "pass">
    : T
  : never;

/** AssignmentConfig with every secret field removed. Safe to log and return. */
export type RedactedAssignmentConfig = Omit<AssignmentConfig, "publishTarget"> & {
  publishTarget: RedactedPublishTarget;
};

/** Shape of the JSON blob encrypted into assignments.secrets_enc. */
type AssignmentSecrets = {
  /** publishTarget.pass for FTP-style targets. */
  publishPass?: string;
  [key: string]: unknown;
};

/**
 * Split an incoming config into the redacted config that gets persisted and
 * the secrets that get encrypted. Never mutates the input.
 */
function splitSecrets(
  config: AssignmentConfig,
  extra?: Record<string, unknown>
): { redacted: RedactedAssignmentConfig; secrets: AssignmentSecrets } {
  const secrets: AssignmentSecrets = { ...(extra ?? {}) };
  const target = config.publishTarget as PublishTarget & { pass?: string };
  let redactedTarget: RedactedPublishTarget;
  if (target && typeof target === "object" && "pass" in target) {
    const { pass, ...rest } = target;
    if (typeof pass === "string" && pass.length > 0) secrets.publishPass = pass;
    redactedTarget = rest as RedactedPublishTarget;
  } else {
    redactedTarget = target as RedactedPublishTarget;
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
  const { orgId, roleKey, name, config, secrets } = params;

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
  }
) {
  const { status, branch, previewUrl, prUrl, publishedUrl, error } = patch;
  const result = await prisma.task.updateMany({
    where: { taskId: id, orgId },
    data: {
      status,
      branch,
      previewUrl,
      prUrl,
      publishedUrl,
      error: error === undefined ? undefined : error.slice(0, TASK_ERROR_MAX),
      updatedAt: new Date(),
    },
  });
  if (result.count === 0) throw new Error("Task not found");
  return result;
}

export async function listTasks(orgId: string, assignmentId?: string) {
  return prisma.task.findMany({
    where: { orgId, ...(assignmentId ? { assignmentId } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

// ── Usage ledger ──

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
    },
  });
}
