/**
 * Pure helpers for the client-facing Task chat (app/api/tasks/[id]/message).
 *
 * The chat's brain is Claude Code headless via lib/harness.ts; each Task is
 * one resumable headless session. These helpers build the per-turn prompt,
 * derive the task branch, and parse the plan JSON the read-only planning turn
 * returns. Kept free of I/O so they can be unit tested without an LLM.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { TaskMessageMode, TaskStatus } from "./platform";

export type PlanEdit = { file: string; change: string };
export type Plan = { summary: string; edits: PlanEdit[]; questions: string[] };

/** Max user message length accepted by the message endpoint. */
export const TASK_MESSAGE_MAX = 20000;

/** How much raw harness output to keep as the summary when the plan is not valid JSON. */
export const FALLBACK_SUMMARY_MAX = 2000;

/** Role key recorded in the usage ledger for chat turns. */
export const TASK_ROLE_KEY = "web-developer";

/** Statuses in which the chat no longer accepts turns. */
export const CHAT_LOCKED_STATUSES: readonly TaskStatus[] = ["published", "discarded", "publishing"];

/** Relative path of the Web Developer job description (the Role's instructions). */
export const JOB_DESCRIPTION_PATH = path.join("agent", "subagents", "web-developer", "instructions.md");

/** Deterministic branch name for a task; same derivation as edit_site. */
export function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

export function isChatLocked(status: string): boolean {
  return (CHAT_LOCKED_STATUSES as readonly string[]).includes(status);
}

export function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Extract the plan JSON from free-form harness output: strip code fences,
 * take the first `{` through the last `}`, and coerce fields to the expected
 * shape. Returns null when nothing parseable is found.
 */
export function parsePlan(output: string): Plan | null {
  let text = output.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const rawEdits = Array.isArray(obj.edits) ? obj.edits : [];
  const edits: PlanEdit[] = rawEdits
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({ file: asString(e.file), change: asString(e.change) }))
    .filter((e) => e.file || e.change);
  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : [];
  const questions = rawQuestions.map(asString).filter((q) => q.length > 0);
  return { summary: asString(obj.summary), edits, questions };
}

/** parsePlan with a fallback: unparseable output becomes the summary. */
export function planFromOutput(output: string): Plan {
  return (
    parsePlan(output) ?? {
      summary: output.slice(0, FALLBACK_SUMMARY_MAX),
      edits: [],
      questions: [],
    }
  );
}

/** Coerce a stored `tasks.plan` JSON value back into a Plan (or null). */
export function planFromJson(value: unknown): Plan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const edits = Array.isArray(obj.edits)
    ? obj.edits
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({ file: asString(e.file), change: asString(e.change) }))
    : [];
  const questions = Array.isArray(obj.questions) ? obj.questions.map(asString).filter(Boolean) : [];
  return { summary: asString(obj.summary), edits, questions };
}

/** Instructions for a read-only planning turn (same contract as plan_changes). */
export function planInstructions(siteDir: string): string {
  return [
    `This turn is a READ-ONLY planning pass. Do NOT modify, create, or delete any files.`,
    `Only inspect the site under the "${siteDir}" directory (use Read, Glob, Grep) so the plan references real files.`,
    `Extract only the concrete edits that apply to files inside "${siteDir}"; ignore anything out of scope for this site.`,
    `Respond ONLY with a single JSON object of this exact shape, with no prose before or after and no code fences:`,
    `{ "summary": string, "edits": [{ "file": string, "change": string }], "questions": string[] }`,
    `- "summary": one short paragraph describing the overall change.`,
    `- "edits": one entry per file to touch; "file" is the path relative to the repo root, "change" describes what to do in that file.`,
    `- "questions": anything ambiguous or missing that the client must answer before the edit can be made (empty array if none).`,
  ].join("\n");
}

/** Instructions for an editing turn. */
export function editInstructions(siteDir: string): string {
  return [
    `This turn makes the change. Edit the files directly; only edit files inside the "${siteDir}" directory and never touch anything outside it.`,
    `Do not run any commands. When you are done, reply with a short plain-language summary of what changed (files and what was edited) for the client.`,
  ].join("\n");
}

/**
 * Build the prompt for one chat turn.
 *
 * First turn of a session (the Task has no headless sessionId yet): the
 * Web Developer job description, the workspace rule ("only edit inside
 * siteDir"), and the Task's original request are prepended so the session
 * starts with full context. Later turns resume the session, so only the
 * mode instructions and the new client message are sent.
 */
export function buildTaskPrompt(opts: {
  firstTurn: boolean;
  jobDescription: string;
  siteDir: string;
  request: string;
  message: string;
  mode: TaskMessageMode;
}): string {
  const parts: string[] = [];
  if (opts.firstTurn) {
    parts.push(
      [
        `# Your job description`,
        `You are rhea, working as the Web Developer for this client. The job description below is your role;`,
        `in this session you work directly on the files in the current directory with your Read/Glob/Grep/Edit/Write tools.`,
        `The platform runs the named tools (plan_changes, edit_site, preview, publish, discard) on the client's behalf; you do not call them yourself.`,
        ``,
        opts.jobDescription.trim(),
      ].join("\n"),
    );
    parts.push(
      [
        `# Workspace rules`,
        `Only edit files inside the "${opts.siteDir}" directory - never touch anything outside it.`,
        `Never run shell commands, never fetch the network, and never publish; a human signs off on every preview and publish.`,
      ].join("\n"),
    );
    parts.push(`# Original request for this Task\n${opts.request.trim()}`);
  }
  parts.push(opts.mode === "plan" ? planInstructions(opts.siteDir) : editInstructions(opts.siteDir));
  parts.push(`# Message from the client\n${opts.message.trim()}`);
  return parts.join("\n\n");
}

/** Read the Web Developer job description from the repo. */
export async function loadJobDescription(root: string = process.cwd()): Promise<string> {
  return fs.readFile(path.join(root, JOB_DESCRIPTION_PATH), "utf8");
}
