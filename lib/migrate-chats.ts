import { queryDsql } from "./dsql.js";

async function runMigration() {
  console.log("Starting DB migration to create agent_chats table...");
  try {
    await queryDsql(`
      CREATE TABLE IF NOT EXISTS agent_chats (
        chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
        agent_session_state JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ agent_chats table created or already exists!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
