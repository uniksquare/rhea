/**
 * Tenant isolation helpers.
 *
 * Every database query in the agent and API layer MUST use these helpers
 * to ensure data is scoped to the authenticated user's organization.
 */

import { queryDsql } from "./dsql";

/**
 * Execute a tenant-scoped query against Aurora DSQL.
 * Prepends org_id as the first parameter ($1) and shifts all other
 * parameter indices accordingly.
 *
 * Usage:
 *   scopedQuery(orgId, "SELECT * FROM incidents WHERE org_id = $1 AND status = $2", ["ACTIVE"])
 *
 * The orgId is always bound to $1. Your additional params start at $2.
 */
export async function scopedQuery(
  orgId: string,
  text: string,
  params: any[] = []
) {
  return queryDsql(text, [orgId, ...params]);
}

/**
 * Get the organization ID for a given user email.
 * Returns null if the user is not found.
 */
export async function getOrgIdForUser(email: string): Promise<string | null> {
  const res = await queryDsql(
    "SELECT org_id FROM users WHERE email = $1;",
    [email]
  );
  return res.rows[0]?.org_id ?? null;
}

/**
 * Get organization details by ID.
 */
export async function getOrganization(orgId: string) {
  const res = await queryDsql(
    "SELECT org_id, name, created_at FROM organizations WHERE org_id = $1;",
    [orgId]
  );
  return res.rows[0] ?? null;
}

/**
 * Get all members of an organization.
 */
export async function getOrgMembers(orgId: string) {
  const res = await queryDsql(
    `SELECT user_id, email, name, role, avatar_url, provider, created_at, last_login
     FROM users WHERE org_id = $1 ORDER BY created_at ASC;`,
    [orgId]
  );
  return res.rows;
}
