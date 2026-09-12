import { test } from "node:test";
import assert from "node:assert/strict";

// lib/db.ts constructs PrismaClient and a pg Pool (lazily) at module scope;
// both need DATABASE_URL present in env to construct without throwing, but
// neither connects until a query actually runs.
process.env.DATABASE_URL ??= "postgresql://x:y@localhost:1/z";

const { sanitizeDbResult } = await import("../lib/db.ts");

test("sanitizeDbResult converts Date to ISO string", () => {
  const d = new Date("2024-01-15T10:30:00.000Z");
  assert.equal(sanitizeDbResult(d), d.toISOString());
});

test("sanitizeDbResult converts BigInt to number", () => {
  assert.equal(sanitizeDbResult(BigInt(42)), 42);
  assert.equal(sanitizeDbResult(BigInt(0)), 0);
});

test("sanitizeDbResult converts large BigInt beyond safe integer to string", () => {
  const big = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(100);
  assert.equal(sanitizeDbResult(big), big.toString());
});

test("sanitizeDbResult keeps null and undefined", () => {
  assert.equal(sanitizeDbResult(null), null);
  assert.equal(sanitizeDbResult(undefined), undefined);
});

test("sanitizeDbResult recurses into arrays", () => {
  const d = new Date("2024-01-15T10:30:00.000Z");
  const out = sanitizeDbResult([d, BigInt(1), null, "x"]);
  assert.deepEqual(out, [d.toISOString(), 1, null, "x"]);
});

test("sanitizeDbResult recurses into nested objects", () => {
  const d = new Date("2024-01-15T10:30:00.000Z");
  const out = sanitizeDbResult({
    createdAt: d,
    count: BigInt(5),
    nested: { updatedAt: d, tags: [BigInt(1), BigInt(2)], missing: undefined, empty: null },
  });
  assert.deepEqual(out, {
    createdAt: d.toISOString(),
    count: 5,
    nested: { updatedAt: d.toISOString(), tags: [1, 2], missing: undefined, empty: null },
  });
});

test("sanitizeDbResult leaves plain scalars untouched", () => {
  assert.equal(sanitizeDbResult("hello"), "hello");
  assert.equal(sanitizeDbResult(42), 42);
  assert.equal(sanitizeDbResult(true), true);
});
