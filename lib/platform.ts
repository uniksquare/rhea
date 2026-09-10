/**
 * rhea platform data layer: Assignments, Tasks, and usage accounting.
 *
 * See docs/naming-and-concepts.md for the product <-> engineering vocabulary
 * (Role = capability, Assignment = deployment, Task = run).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { AssignmentConfig } from "./assignment-types";

export type { AssignmentConfig } from "./assignment-types";

export type TaskStatus =
  | "requested"
  | "planning"
  | "previewed"
  | "published"
  | "discarded"
  | "failed";

// lib/crypto.ts exports AES-256-GCM encrypt/decrypt; assignment secrets are
// encrypted at rest before being written to assignments.secrets_enc.
import { encrypt } from "./crypto";

// ── Assignments ──

export async function createAssignment(params: {
  orgId: string;
  roleKey: string;
  name: string;
  config: AssignmentConfig;
  secrets?: string;
}) {
  const { orgId, roleKey, name, config, secrets } = params;

  const secretsEnc = secrets !== undefined ? encrypt(secrets) : undefined;

  return prisma.assignment.create({
    data: {
      orgId,
      roleKey,
      name,
      config: config as unknown as Prisma.InputJsonValue,
      secretsEnc,
    },
  });
}

export async function getAssignment(id: string) {
  return prisma.assignment.findUnique({ where: { assignmentId: id } });
}

export async function listAssignments(orgId: string) {
  return prisma.assignment.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
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

export async function updateTask(
  id: string,
  updates: {
    status?: TaskStatus;
    branch?: string;
    previewUrl?: string;
    prUrl?: string;
    publishedUrl?: string;
    error?: string;
  }
) {
  const { status, branch, previewUrl, prUrl, publishedUrl, error } = updates;
  return prisma.task.update({
    where: { taskId: id },
    data: {
      status,
      branch,
      previewUrl,
      prUrl,
      publishedUrl,
      error,
      updatedAt: new Date(),
    },
  });
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
