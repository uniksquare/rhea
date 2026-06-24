import pg from 'pg';
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

// Parse DATABASE_URL: postgresql://admin@<endpoint>:5432/postgres
const match = dbUrl.match(/postgresql:\/\/([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!match) {
  console.error("Failed to parse DATABASE_URL");
  process.exit(1);
}

const [, user, host, port, database] = match;
const region = host.split('.')[2] || 'ap-south-1'; // Extract region (e.g. ap-south-1) from hostname

console.log(`Connecting to DSQL: host=${host}, region=${region}, user=${user}, database=${database}`);

async function run() {
  const signer = new DsqlSigner({
    hostname: host,
    region: region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
  });

  const password = await signer.getDbConnectAdminAuthToken();

  const client = new pg.Client({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    ssl: {
      rejectUnauthorized: false // Required for Aurora DSQL connection
    }
  });

  await client.connect();
  console.log("✓ Connected to Aurora DSQL cluster successfully!");

  const queries = [
    // ── Core tables ──
    `CREATE TABLE IF NOT EXISTS organizations (
        org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // ── Auth & multi-tenancy tables ──
    `CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL, -- Managed at application layer
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'VIEWER',
        avatar_url TEXT,
        provider VARCHAR(50),
        provider_account_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS api_keys (
        key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        created_by UUID,
        key_hash VARCHAR(64) NOT NULL,
        key_prefix VARCHAR(8) NOT NULL,
        label VARCHAR(255),
        scopes JSONB,
        expires_at TIMESTAMP,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS org_settings (
        org_id UUID PRIMARY KEY,
        settings JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // ── Incident & investigation tables (tenant-scoped) ──
    `CREATE TABLE IF NOT EXISTS incidents (
        incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        severity VARCHAR(50),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        agent_session_state JSONB, -- Stores Eve agent session state
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS investigations (
        investigation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        incident_id UUID NOT NULL,
        ranked_causes JSONB,
        findings TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS root_causes (
        cause_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        investigation_id UUID NOT NULL,
        category VARCHAR(100),
        description TEXT,
        confidence FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS fix_patterns (
        pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        cause_category VARCHAR(100),
        remediation_template TEXT,
        success_rate FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS connector_instances (
        instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        connector_type VARCHAR(100) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        mcp_url TEXT NOT NULL,
        connect_provider_id VARCHAR(100) NOT NULL,
        connected_by UUID,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        last_health_check TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        connected_at TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS sandbox_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        org_id UUID NOT NULL,
        user_id UUID,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        allowed_domains JSONB DEFAULT '[]',
        config_limits JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS sandbox_executions (
        execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) NOT NULL,
        command TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        exit_code INT,
        stdout TEXT,
        stderr TEXT,
        execution_time_ms INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS agent_chats (
        chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
        agent_session_state JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // ── Alters for pre-existing tables to ensure columns exist ──
    `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS org_id UUID;`,
    `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS agent_session_state JSONB;`,
    `ALTER TABLE investigations ADD COLUMN IF NOT EXISTS org_id UUID;`,
    `ALTER TABLE root_causes ADD COLUMN IF NOT EXISTS org_id UUID;`,
    `ALTER TABLE fix_patterns ADD COLUMN IF NOT EXISTS org_id UUID;`,
    `ALTER TABLE connector_instances ADD COLUMN IF NOT EXISTS mcp_url TEXT;`,
    `ALTER TABLE connector_instances ADD COLUMN IF NOT EXISTS connect_provider_id VARCHAR(100);`,

    // ── Seed default org ──
    `INSERT INTO organizations (name)
    SELECT 'Rhea Default Org'
    WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);`
  ];

  console.log("Creating tables...");
  for (const q of queries) {
    await client.query(q);
  }
  console.log("✓ Database tables created successfully!");

  const res = await client.query("SELECT * FROM organizations;");
  console.log("Active Organization:", res.rows[0]);

  await client.end();
}

run().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
