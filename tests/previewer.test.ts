import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeValue, slug } from "../lib/previewer.ts";

function rejects(name: string, value: unknown, kind: Parameters<typeof assertSafeValue>[2]) {
  assert.throws(() => assertSafeValue(name, value, kind));
}

function accepts(name: string, value: unknown, kind: Parameters<typeof assertSafeValue>[2]) {
  assert.doesNotThrow(() => assertSafeValue(name, value, kind));
}

test("assertSafeValue rejects CR/LF/NUL in every kind", () => {
  const kinds = ["host", "port", "path", "user", "pass", "plain"] as const;
  for (const kind of kinds) {
    if (kind === "port") continue; // port is numeric, control-char check is string-only
    rejects("v", "bad\rvalue", kind);
    rejects("v", "bad\nvalue", kind);
    rejects("v", "bad\0value", kind);
  }
});

test("assertSafeValue rejects bad host chars", () => {
  rejects("host", "exa mple.com", "host");
  rejects("host", "example.com/path", "host");
  rejects("host", "example.com;rm -rf", "host");
  accepts("host", "example.com", "host");
  accepts("host", "sub.example-host.com", "host");
});

test("assertSafeValue rejects bad ports", () => {
  rejects("port", 0, "port");
  rejects("port", 70000, "port");
  rejects("port", 21.5, "port");
  rejects("port", "21", "port");
  accepts("port", 21, "port");
  accepts("port", 1, "port");
  accepts("port", 65535, "port");
});

test("assertSafeValue rejects paths with quotes, backslashes, leading dash", () => {
  rejects("path", '/some/"quoted"/dir', "path");
  rejects("path", "C:\\Users\\evil", "path");
  rejects("path", "-rf", "path");
  accepts("path", "/some/safe/dir", "path");
});

test("assertSafeValue rejects user containing a comma", () => {
  rejects("user", "user,name", "user");
  accepts("user", "username", "user");
});

test("assertSafeValue accepts sane plain values", () => {
  accepts("plain", "hello world", "plain");
});

test("assertSafeValue rejects empty/non-string values for non-port kinds", () => {
  rejects("v", "", "plain");
  rejects("v", 123, "plain");
});

test("slug produces safe branch slugs", () => {
  assert.equal(slug("feat/New Hero"), "feat-new-hero");
  assert.equal(slug("Fix Bug #123!!"), "fix-bug-123");
  assert.equal(slug("---leading-trailing---"), "leading-trailing");
  assert.equal(slug(""), "preview");
  assert.match(slug("weird///chars\\here"), /^[a-z0-9-]+$/);
  assert.ok(slug("a".repeat(200)).length <= 80);
});
