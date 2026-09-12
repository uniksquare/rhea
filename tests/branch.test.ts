import { test } from "node:test";
import assert from "node:assert/strict";

// Reimplemented verbatim from
// agent/subagents/web-developer/tools/edit_site.ts (branchForTask is not
// exported there, so it is copied here rather than modified).
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

test("branchForTask is deterministic for the same taskId", () => {
  const id = "abc-123-def-456";
  assert.equal(branchForTask(id), branchForTask(id));
});

test("branchForTask strips non-alphanumeric characters and takes first 8 chars", () => {
  assert.equal(branchForTask("abc-123-def-456"), "task/abc123de");
  assert.equal(branchForTask("uuid:1234-5678-90ab"), "task/uuid1234");
});

test("branchForTask output charset is task/ followed by up to 8 alphanumerics", () => {
  const out = branchForTask("!!!___...weird$$$id%%%987");
  assert.match(out, /^task\/[a-zA-Z0-9]{0,8}$/);
});

test("branchForTask handles short ids without padding", () => {
  assert.equal(branchForTask("ab"), "task/ab");
});

test("branchForTask handles empty id", () => {
  assert.equal(branchForTask(""), "task/");
});
