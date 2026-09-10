import { test } from "node:test";
import assert from "node:assert/strict";
import { SAFE_TOOLS, READ_ONLY_TOOLS, resolveToolPolicy } from "../lib/harness.ts";

// lib/harness.ts keeps effectiveTools (the allowed-tools intersection
// helper) as a module-local function; resolveToolPolicy wraps it and is the
// exported surface tested here.

test("SAFE_TOOLS never allows Bash", () => {
  assert.ok(!(SAFE_TOOLS as readonly string[]).includes("Bash"));
});

test("SAFE_TOOLS never allows WebFetch", () => {
  assert.ok(!(SAFE_TOOLS as readonly string[]).includes("WebFetch"));
});

test("SAFE_TOOLS contains the expected safe tool set", () => {
  assert.deepEqual([...SAFE_TOOLS], ["Read", "Edit", "MultiEdit", "Write", "Glob", "Grep"]);
});

test("resolveToolPolicy: default allows SAFE_TOOLS and always disallows Bash", () => {
  const p = resolveToolPolicy({});
  assert.deepEqual(p.allowed, [...SAFE_TOOLS]);
  assert.ok(p.disallowed.includes("Bash"));
  assert.ok(p.disallowed.includes("WebFetch"));
  assert.ok(p.disallowed.includes("WebSearch"));
});

test("resolveToolPolicy: allowedTools is intersected with SAFE_TOOLS", () => {
  const p = resolveToolPolicy({ allowedTools: ["Read", "Bash", "WebFetch", "Write"] });
  assert.deepEqual(p.allowed, ["Read", "Write"]);
  assert.ok(p.disallowed.includes("Bash"));
});

test("resolveToolPolicy: an all-unsafe allow list falls back to SAFE_TOOLS", () => {
  const p = resolveToolPolicy({ allowedTools: ["Bash"] });
  assert.deepEqual(p.allowed, [...SAFE_TOOLS]);
});

test("resolveToolPolicy: readOnly never allows Write/Edit/Bash even if requested", () => {
  const p = resolveToolPolicy({
    readOnly: true,
    allowedTools: ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"],
  });
  assert.deepEqual(p.allowed, ["Read", "Glob", "Grep"]);
  for (const t of ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"]) {
    assert.ok(!p.allowed.includes(t), `${t} must not be allowed`);
    assert.ok(p.disallowed.includes(t), `${t} must be disallowed`);
  }
});

test("resolveToolPolicy: readOnly with no allow list yields READ_ONLY_TOOLS", () => {
  const p = resolveToolPolicy({ readOnly: true });
  assert.deepEqual(p.allowed, [...READ_ONLY_TOOLS]);
});

test("resolveToolPolicy: readOnly with only mutating tools requested still yields READ_ONLY_TOOLS", () => {
  const p = resolveToolPolicy({ readOnly: true, allowedTools: ["Write", "Edit"] });
  assert.deepEqual(p.allowed, [...READ_ONLY_TOOLS]);
});

test("resolveToolPolicy: caller disallowedTools are merged and removed from allowed", () => {
  const p = resolveToolPolicy({ allowedTools: ["Read", "Write"], disallowedTools: ["Write"] });
  assert.deepEqual(p.allowed, ["Read"]);
  assert.ok(p.disallowed.includes("Write"));
  assert.ok(p.disallowed.includes("Bash"));
});

test("resolveToolPolicy: disallowed always includes Bash regardless of input", () => {
  for (const opts of [
    {},
    { readOnly: true },
    { allowedTools: ["Bash"] },
    { disallowedTools: [] },
    { readOnly: false, allowedTools: ["Read", "Write"], disallowedTools: ["Read"] },
  ]) {
    assert.ok(resolveToolPolicy(opts).disallowed.includes("Bash"), JSON.stringify(opts));
  }
});
