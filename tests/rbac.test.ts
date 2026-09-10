import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission, hasMinRole, requirePermission, ALL_ROLES, type Role } from "../lib/rbac.ts";

// CLIENT: can request and preview (discard) tasks, cannot publish or manage assignments.
test("CLIENT can tasks:request", () => {
  assert.equal(hasPermission("CLIENT", "tasks:request"), true);
});

test("CLIENT can tasks:discard", () => {
  assert.equal(hasPermission("CLIENT", "tasks:discard"), true);
});

test("CLIENT cannot tasks:publish", () => {
  assert.equal(hasPermission("CLIENT", "tasks:publish"), false);
});

test("CLIENT cannot assignments:manage", () => {
  assert.equal(hasPermission("CLIENT", "assignments:manage"), false);
});

// VIEWER: below OPERATOR/CLIENT, cannot request tasks.
test("VIEWER cannot tasks:request", () => {
  assert.equal(hasPermission("VIEWER", "tasks:request"), false);
});

test("VIEWER cannot tasks:discard", () => {
  assert.equal(hasPermission("VIEWER", "tasks:discard"), false);
});

// ADMIN and OWNER can do everything above (tasks:request/discard/publish, assignments:manage).
const adminAndAboveActions = [
  "tasks:request",
  "tasks:discard",
  "tasks:publish",
  "assignments:manage",
] as const;

for (const role of ["ADMIN", "OWNER"] as Role[]) {
  for (const action of adminAndAboveActions) {
    test(`${role} can ${action}`, () => {
      assert.equal(hasPermission(role, action), true);
    });
  }
}

// OPERATOR is a peer of CLIENT: can request/discard tasks but not publish or manage assignments.
test("OPERATOR can tasks:request", () => {
  assert.equal(hasPermission("OPERATOR", "tasks:request"), true);
});

test("OPERATOR can tasks:discard", () => {
  assert.equal(hasPermission("OPERATOR", "tasks:discard"), true);
});

test("OPERATOR cannot tasks:publish", () => {
  assert.equal(hasPermission("OPERATOR", "tasks:publish"), false);
});

test("OPERATOR cannot assignments:manage", () => {
  assert.equal(hasPermission("OPERATOR", "assignments:manage"), false);
});

// hasMinRole documented behaviour: CLIENT is a peer of OPERATOR (same hierarchy
// level), so each satisfies a minimum-role check against the other.
test("hasMinRole(CLIENT, OPERATOR) is true because CLIENT is a peer level, not below", () => {
  assert.equal(hasMinRole("CLIENT", "OPERATOR"), true);
});

test("hasMinRole(OPERATOR, CLIENT) is true because OPERATOR is a peer level, not below", () => {
  assert.equal(hasMinRole("OPERATOR", "CLIENT"), true);
});

test("hasMinRole(CLIENT, ADMIN) is false: CLIENT is below ADMIN", () => {
  assert.equal(hasMinRole("CLIENT", "ADMIN"), false);
});

test("hasMinRole(VIEWER, CLIENT) is false: VIEWER is below CLIENT", () => {
  assert.equal(hasMinRole("VIEWER", "CLIENT"), false);
});

// requirePermission: throws for insufficient role, does not throw for sufficient role.
test("requirePermission throws for VIEWER on tasks:request", () => {
  assert.throws(() => requirePermission("VIEWER", "tasks:request"));
});

test("requirePermission does not throw for CLIENT on tasks:request", () => {
  assert.doesNotThrow(() => requirePermission("CLIENT", "tasks:request"));
});

test("requirePermission throws for CLIENT on tasks:publish", () => {
  assert.throws(() => requirePermission("CLIENT", "tasks:publish"));
});

test("requirePermission throws for undefined role", () => {
  assert.throws(() => requirePermission(undefined, "tasks:request"));
});

// ALL_ROLES includes CLIENT with the specified description.
test("ALL_ROLES includes CLIENT with the expected description", () => {
  const client = ALL_ROLES.find((r) => r.value === "CLIENT");
  assert.ok(client);
  assert.equal(client?.description, "Client: request and preview site changes");
});
