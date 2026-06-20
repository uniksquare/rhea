import { queryDsql } from './dsql.js';
import { putItem, getItem } from './dynamodb.js';

async function test() {
  console.log("=== Testing Amazon Aurora DSQL ===");
  try {
    const res = await queryDsql("SELECT * FROM organizations LIMIT 1;");
    console.log("DSQL Success! Found organization:", res.rows[0]);
  } catch (err) {
    console.error("DSQL Connection failed:", err);
  }

  console.log("\n=== Testing AWS DynamoDB ===");
  try {
    const testSessionId = `test-session-${Date.now()}`;
    await putItem("Sessions", {
      session_id: testSessionId,
      created_at: new Date().toISOString(),
      status: "ACTIVE"
    });
    console.log("DynamoDB putItem Success!");

    const item = await getItem("Sessions", { session_id: testSessionId });
    console.log("DynamoDB getItem Success! Retrieved:", item);
  } catch (err) {
    console.error("DynamoDB Connection failed:", err);
  }
}

test().catch(console.error);
