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
        org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
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
        org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(user_id),
        key_hash VARCHAR(64) NOT NULL,
        key_prefix VARCHAR(8) NOT NULL,
        label VARCHAR(255),
        scopes TEXT[],
        expires_at TIMESTAMP,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS org_settings (
        org_id UUID PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
        settings JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // ── Incident & investigation tables (tenant-scoped) ──
    `CREATE TABLE IF NOT EXISTS incidents (
        incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        severity VARCHAR(50),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS investigations (
        investigation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
        incident_id UUID REFERENCES incidents(incident_id) ON DELETE CASCADE,
        ranked_causes JSONB,
        findings TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS root_causes (
        cause_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
        investigation_id UUID REFERENCES investigations(investigation_id) ON DELETE CASCADE,
        category VARCHAR(100),
        description TEXT,
        confidence FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS fix_patterns (
        pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
        cause_category VARCHAR(100),
        remediation_template TEXT,
        success_rate FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

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
