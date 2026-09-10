/**
 * Assignment config validation.
 *
 * An Assignment's config drives filesystem reads (harness, siteDir), git
 * commands (baseBranch) and outbound FTP/Vercel deploys, so an ADMIN of any
 * org must not be able to point it at arbitrary host directories or inject
 * values into the lftp script. Everything here throws a readable
 * AssignmentConfigError and returns a normalized config on success.
 *
 * Workspace roots: `workspacePath` must live under one of the absolute dirs
 * listed in RHEA_WORKSPACE_ROOTS (comma separated). When unset, the only
 * root is `<cwd>/workspaces`. lib/previewer.ts `siteDirOf` re-runs the same
 * checks at deploy time so a row written before this validator existed (or
 * edited directly in the DB) still cannot escape.
 */

import path from "node:path";
import type { AssignmentConfig, PublishTarget } from "./assignment-types";
// Relative imports with .ts extension: eve's bundler ignores tsconfig paths.
import { SAFE_TOOLS } from "./harness.ts";
import { assertSafeValue } from "./previewer.ts";

export class AssignmentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentConfigError";
  }
}

const CONTROL = /[\r\n\0]/;
const BRANCH_RE = /^[A-Za-z0-9._\/-]{1,100}$/;
const REPO_URL_MAX = 500;
const SAFE_TOOL_SET = new Set<string>(SAFE_TOOLS);

function fail(message: string): never {
  throw new AssignmentConfigError(message);
}

/** Wrap assertSafeValue so callers get an AssignmentConfigError. */
function safe(name: string, value: unknown, kind: Parameters<typeof assertSafeValue>[2]): void {
  try {
    assertSafeValue(name, value, kind);
  } catch (err) {
    fail((err as Error).message);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasDotDotSegment(p: string): boolean {
  return p.split(/[\\/]/).some((seg) => seg === "..");
}

/** True when `child` equals `parent` or lives underneath it (both resolved). */
function isInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const prefix = parent.endsWith(path.sep) ? parent : parent + path.sep;
  return child.startsWith(prefix);
}

/**
 * Allowlisted workspace roots (absolute, resolved). Read at call time so a
 * test or a late dotenv load can set RHEA_WORKSPACE_ROOTS after import.
 */
export function workspaceRoots(): string[] {
  const raw = process.env.RHEA_WORKSPACE_ROOTS ?? "";
  const roots = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => path.resolve(s));
  return roots.length > 0 ? roots : [path.join(process.cwd(), "workspaces")];
}

/**
 * Root check: `value` must be an absolute path with no `..` segments that
 * lives inside one of workspaceRoots(). Returns the resolved path.
 */
export function assertWorkspacePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("workspacePath: must be a non-empty string");
  }
  if (CONTROL.test(value)) fail("workspacePath: control characters are not allowed");
  if (!path.isAbsolute(value)) fail("workspacePath: must be an absolute path");
  if (hasDotDotSegment(value)) fail('workspacePath: ".." segments are not allowed');
  // lftp receives this as localDir, so it must also pass the script-safety check.
  safe("workspacePath", value, "path");
  const resolved = path.resolve(value);
  const roots = workspaceRoots();
  if (!roots.some((root) => isInside(resolved, root))) {
    fail(
      `workspacePath: must be inside an allowed workspace root (${roots.join(", ")}); set RHEA_WORKSPACE_ROOTS to change`
    );
  }
  return resolved;
}

/**
 * Validate `siteDir` (default "shared") and return the absolute site dir.
 * Throws unless `<workspacePath>/<siteDir>` stays inside workspacePath.
 * `workspacePath` must already have passed assertWorkspacePath.
 */
export function resolveSiteDir(workspacePath: string, siteDir: unknown): string {
  const dir = siteDir === undefined || siteDir === null ? "shared" : siteDir;
  if (typeof dir !== "string" || dir.length === 0) fail("siteDir: must be a non-empty string");
  if (CONTROL.test(dir)) fail("siteDir: control characters are not allowed");
  if (path.isAbsolute(dir) || dir.startsWith("/") || dir.startsWith("\\")) {
    fail("siteDir: must be a relative path");
  }
  if (hasDotDotSegment(dir)) fail('siteDir: ".." segments are not allowed');
  safe("siteDir", dir, "path");
  const full = path.resolve(workspacePath, dir);
  if (!isInside(full, path.resolve(workspacePath))) {
    fail("siteDir: must stay inside workspacePath");
  }
  return full;
}

function validateBranch(name: string, value: unknown): string {
  if (typeof value !== "string" || !BRANCH_RE.test(value)) {
    fail(`${name}: must match [A-Za-z0-9._/-] and be 1-100 chars`);
  }
  if (value.startsWith("-") || value.includes("..")) {
    fail(`${name}: must not start with "-" or contain ".."`);
  }
  return value;
}

function validateRepoUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) fail("repoUrl: must be a non-empty string");
  if (value.length > REPO_URL_MAX) fail(`repoUrl: must be at most ${REPO_URL_MAX} chars`);
  if (value === "local") return value;
  if (/[\s\0]/.test(value)) fail("repoUrl: whitespace is not allowed");
  if (value.startsWith("https://")) {
    try {
      const u = new URL(value);
      if (u.protocol !== "https:" || !u.hostname) throw new Error();
    } catch {
      fail("repoUrl: must be a valid https:// URL");
    }
    return value;
  }
  if (/^git@[A-Za-z0-9.-]+:[A-Za-z0-9._\/-]+$/.test(value)) return value;
  fail('repoUrl: must be "local", an https:// URL, or a git@host:path URL');
}

function validateAllowedTools(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) fail("allowedTools: must be an array of tool names");
  const out: string[] = [];
  for (const t of value) {
    if (typeof t !== "string" || !SAFE_TOOL_SET.has(t)) {
      fail(`allowedTools: "${String(t).slice(0, 40)}" is not allowed; permitted: ${SAFE_TOOLS.join(", ")}`);
    }
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function validateModel(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !/^[A-Za-z0-9._:@\/-]{1,120}$/.test(value)) {
    fail("model: must match [A-Za-z0-9._:@/-] and be 1-120 chars");
  }
  return value;
}

function validateBaseUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) fail("publishTarget.baseUrl: must be a non-empty string");
  if (CONTROL.test(value)) fail("publishTarget.baseUrl: control characters are not allowed");
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    fail("publishTarget.baseUrl: must be a valid http(s) URL");
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname) {
    fail("publishTarget.baseUrl: must be an http:// or https:// URL");
  }
  return value.replace(/\/+$/, "");
}

function validatePublishTarget(value: unknown): PublishTarget {
  if (!isRecord(value)) fail("publishTarget: must be an object");
  const type = value.type;
  if (type === "hostinger-ftp") {
    safe("publishTarget.host", value.host, "host");
    const port = value.port === undefined || value.port === null ? 21 : value.port;
    safe("publishTarget.port", port, "port");
    safe("publishTarget.user", value.user, "user");
    safe("publishTarget.remoteDir", value.remoteDir, "path");
    const baseUrl = validateBaseUrl(value.baseUrl);
    let pass = "";
    if (value.pass !== undefined && value.pass !== null) {
      if (typeof value.pass !== "string") fail("publishTarget.pass: must be a string");
      if (CONTROL.test(value.pass)) fail("publishTarget.pass: control characters are not allowed");
      pass = value.pass;
    }
    return {
      type: "hostinger-ftp",
      host: value.host as string,
      port: port as number,
      user: value.user as string,
      pass,
      remoteDir: value.remoteDir as string,
      baseUrl,
    };
  }
  if (type === "vercel") {
    const out: Extract<PublishTarget, { type: "vercel" }> = { type: "vercel" };
    for (const key of ["projectId", "orgId", "scope"] as const) {
      const v = value[key];
      if (v === undefined || v === null || v === "") continue;
      safe(`publishTarget.${key}`, v, "plain");
      if (typeof v === "string" && v.length > 200) fail(`publishTarget.${key}: too long`);
      out[key] = v as string;
    }
    if (value.prodBranch !== undefined && value.prodBranch !== null && value.prodBranch !== "") {
      out.prodBranch = validateBranch("publishTarget.prodBranch", value.prodBranch);
    }
    // token is a secret: stripped into secrets.vercelToken by splitSecrets
    // before the config is persisted. Never echo the value in a fail() message.
    if (value.token !== undefined && value.token !== null && value.token !== "") {
      if (typeof value.token !== "string") fail("publishTarget.token: must be a string");
      if (CONTROL.test(value.token)) fail("publishTarget.token: control characters are not allowed");
      if (value.token.length > 500) fail("publishTarget.token: too long");
      out.token = value.token;
    }
    return out;
  }
  fail("publishTarget.type must be hostinger-ftp or vercel");
}

/**
 * Validate an untrusted AssignmentConfig and return a normalized copy.
 * Throws AssignmentConfigError with a message that is safe to return to the
 * caller (credentials are never echoed).
 */
export function validateAssignmentConfig(config: unknown): AssignmentConfig {
  if (!isRecord(config)) fail("config: must be an object");

  const repoUrl = validateRepoUrl(config.repoUrl);
  const workspacePath = assertWorkspacePath(config.workspacePath);
  const siteDir = config.siteDir === undefined || config.siteDir === null ? "shared" : config.siteDir;
  resolveSiteDir(workspacePath, siteDir);
  const baseBranch =
    config.baseBranch === undefined || config.baseBranch === null || config.baseBranch === ""
      ? undefined
      : validateBranch("baseBranch", config.baseBranch);
  const publishTarget = validatePublishTarget(config.publishTarget);
  const allowedTools = validateAllowedTools(config.allowedTools);
  const model = validateModel(config.model);

  const out: AssignmentConfig = {
    repoUrl,
    workspacePath,
    siteDir: siteDir as string,
    publishTarget,
  };
  if (baseBranch !== undefined) out.baseBranch = baseBranch;
  if (allowedTools !== undefined) out.allowedTools = allowedTools;
  if (model !== undefined) out.model = model;
  return out;
}
