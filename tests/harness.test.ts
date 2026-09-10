import { test } from "node:test";
import assert from "node:assert/strict";
import { SAFE_TOOLS } from "../lib/harness.ts";

// lib/harness.ts keeps effectiveTools (the allowed-tools intersection
// helper) as a module-local function; it is not exported, so only SAFE_TOOLS
// itself is tested here.

test("SAFE_TOOLS never allows Bash", () => {
  assert.ok(!(SAFE_TOOLS as readonly string[]).includes("Bash"));
});

test("SAFE_TOOLS never allows WebFetch", () => {
  assert.ok(!(SAFE_TOOLS as readonly string[]).includes("WebFetch"));
});

test("SAFE_TOOLS contains the expected safe tool set", () => {
  assert.deepEqual([...SAFE_TOOLS], ["Read", "Edit", "MultiEdit", "Write", "Glob", "Grep"]);
});
