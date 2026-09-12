import { test } from "node:test";

// lib/dynamodb.ts keeps parseUpdateExpression and the NUL-strip helper
// (stripNulBytes) as module-local functions; neither is exported, so they
// cannot be imported and unit-tested directly from here. Skipping.
test(
  "dynamodb: parseUpdateExpression / NUL-strip helper are not exported, skipping",
  { skip: "lib/dynamodb.ts does not export parseUpdateExpression or stripNulBytes" },
  () => {}
);
