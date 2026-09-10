import { queryDsql, prisma } from './dsql.js';
import { putItem, getItem } from './dynamodb.js';

async function test() {
  console.log("=== Testing Neon Postgres (Prisma) ===");
  try {
    const res = await queryDsql("SELECT * FROM organizations LIMIT 1;");
    console.log("Postgres Success! Found organization:", res.rows[0]);
  } catch (err) {
    console.error("Postgres Connection failed:", err);
  }

  console.log("\n=== Testing hook tables (hook_sessions) ===");
  try {
    const testSessionId = `test-session-${Date.now()}`;
    await putItem("Sessions", {
      session_id: testSessionId,
      created_at: new Date().toISOString(),
      status: "ACTIVE"
    });
    console.log("putItem Success!");

    const item = await getItem("Sessions", { session_id: testSessionId });
    console.log("getItem Success! Retrieved:", item);

    await queryDsql("DELETE FROM hook_sessions WHERE session_id = $1;", [testSessionId]);
  } catch (err) {
    console.error("Hook table access failed:", err);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
