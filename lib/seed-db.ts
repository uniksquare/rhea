import { queryDsql } from "./dsql";

async function seed() {
  console.log("Connecting to database for seeding...");
  
  // 1. Get or create an organization
  let orgId: string;
  const orgRes = await queryDsql("SELECT org_id, name FROM organizations ORDER BY created_at ASC LIMIT 1;");
  if (orgRes.rows.length === 0) {
    console.log("No organization found. Creating default...");
    const newOrg = await queryDsql("INSERT INTO organizations (name) VALUES ('Rhea Default Org') RETURNING org_id;");
    orgId = newOrg.rows[0].org_id;
  } else {
    orgId = orgRes.rows[0].org_id;
    console.log(`Using organization: ${orgRes.rows[0].name} (${orgId})`);
  }

  // 2. Clear old data (optional, but good for clean start in development)
  console.log("Cleaning up old mock data...");
  await queryDsql("DELETE FROM root_causes WHERE org_id = $1;", [orgId]);
  await queryDsql("DELETE FROM investigations WHERE org_id = $1;", [orgId]);
  await queryDsql("DELETE FROM incidents WHERE org_id = $1;", [orgId]);
  await queryDsql("DELETE FROM fix_patterns WHERE org_id = $1;", [orgId]);

  console.log("Seeding new mock data...");

  // 3. Seed fix patterns
  const patterns = [
    {
      category: "Database Connection Pool",
      template: "import { queryDsql } from '@/lib/dsql';\n\nexport async function fixPool() {\n  // Check active connections\n  const res = await queryDsql(\"SHOW max_connections;\");\n  console.log(\"Max connections:\", res.rows[0]);\n  // Recommended: Increase pool size in application configuration\n}",
      success_rate: 0.92
    },
    {
      category: "Disk Space Depletion",
      template: "# Clean docker prune and log files\ndf -h\ndocker system prune -af --volumes\nfind /var/log -type f -name '*.log' -delete",
      success_rate: 0.88
    },
    {
      category: "Redis CPU Spike",
      template: "// Flush idle client connections and verify slowlog\nCLIENT LIST\nSLOWLOG GET 10\nCLIENT KILL TYPE normal",
      success_rate: 0.75
    }
  ];

  for (const p of patterns) {
    await queryDsql(
      `INSERT INTO fix_patterns (org_id, cause_category, remediation_template, success_rate)
       VALUES ($1, $2, $3, $4);`,
      [orgId, p.category, p.template, p.success_rate]
    );
  }
  console.log("✓ Seeded fix patterns");

  // 4. Seed Incidents, Investigations, and Root Causes
  
  // Incident 1: Critical (ACTIVE)
  const inc1 = await queryDsql(
    `INSERT INTO incidents (org_id, title, description, severity, status)
     VALUES ($1, 'Payment Gateway API Outage', 'Critical billing endpoint /api/charge is returning 504 Gateway Timeouts to clients. Major impact on checkout flows.', 'CRITICAL', 'ACTIVE')
     RETURNING incident_id;`,
    [orgId]
  );
  const inc1Id = inc1.rows[0].incident_id;

  // Incident 2: High (INVESTIGATING)
  const inc2 = await queryDsql(
    `INSERT INTO incidents (org_id, title, description, severity, status)
     VALUES ($1, 'Aurora DSQL Connection pool exhausted', 'Backend log files show pg-pool errors: \"timeout expired while waiting for connection\". High latency on API gateways.', 'HIGH', 'INVESTIGATING')
     RETURNING incident_id;`,
    [orgId]
  );
  const inc2Id = inc2.rows[0].incident_id;

  const inv2 = await queryDsql(
    `INSERT INTO investigations (org_id, incident_id, ranked_causes, findings)
     VALUES ($1, $2, $3, $4)
     RETURNING investigation_id;`,
    [
      orgId,
      inc2Id,
      JSON.stringify([
        { cause: "Connection pool size set too low (10)", confidence: 0.85 },
        { cause: "Missing db client release in /api/charge", confidence: 0.75 },
        { cause: "Spike in concurrent checkouts", confidence: 0.40 }
      ]),
      "Analysis of server metrics shows active connection count pinned at 10. The logs indicate several hanging transactions originating from the charging endpoint. The connection pool size is insufficient for the current traffic load."
    ]
  );
  const inv2Id = inv2.rows[0].investigation_id;

  await queryDsql(
    `INSERT INTO root_causes (org_id, investigation_id, category, description, confidence)
     VALUES ($1, $2, 'Database Connection Pool', 'The application database connection pool size is capped at 10, while the incoming traffic volume requires at least 50 connections.', 0.85);`,
    [orgId, inv2Id]
  );
  console.log("✓ Seeded incident 2 (High, Investigating)");

  // Incident 3: Medium (RESOLVED)
  const inc3 = await queryDsql(
    `INSERT INTO incidents (org_id, title, description, severity, status, resolved_at)
     VALUES ($1, 'Disk space high on sandbox-remediation host', 'Alert triggered: Disk utilization exceeds 90% on host rhea-sandbox-01.', 'MEDIUM', 'RESOLVED', CURRENT_TIMESTAMP - INTERVAL '2 hours')
     RETURNING incident_id;`,
    [orgId]
  );
  const inc3Id = inc3.rows[0].incident_id;

  const inv3 = await queryDsql(
    `INSERT INTO investigations (org_id, incident_id, ranked_causes, findings)
     VALUES ($1, $2, $3, $4)
     RETURNING investigation_id;`,
    [
      orgId,
      inc3Id,
      JSON.stringify([
        { cause: "Dangling Docker build cache volumes", confidence: 0.95 },
        { cause: "Large unstructured audit log files", confidence: 0.60 }
      ]),
      "Disk cleanup ran successfully. Freed 42GB of space by removing dangling containers and pruning the system cache."
    ]
  );
  const inv3Id = inv3.rows[0].investigation_id;

  await queryDsql(
    `INSERT INTO root_causes (org_id, investigation_id, category, description, confidence)
     VALUES ($1, $2, 'Disk Space Depletion', 'Dangling Docker container volumes accumulated over 30 days of running sandbox trials without automatic cleanup.', 0.95);`,
    [orgId, inv3Id]
  );
  console.log("✓ Seeded incident 3 (Medium, Resolved)");

  // Incident 4: Medium (RESOLVED)
  const inc4 = await queryDsql(
    `INSERT INTO incidents (org_id, title, description, severity, status, resolved_at)
     VALUES ($1, 'Redis CPU spike on cache layer', 'ElastiCache Redis CPU utilization at 98%. Cache reads/writes failing with latency timeouts.', 'MEDIUM', 'RESOLVED', CURRENT_TIMESTAMP - INTERVAL '1 day')
     RETURNING incident_id;`,
    [orgId]
  );
  const inc4Id = inc4.rows[0].incident_id;

  const inv4 = await queryDsql(
    `INSERT INTO investigations (org_id, incident_id, ranked_causes, findings)
     VALUES ($1, $2, $3, $4)
     RETURNING investigation_id;`,
    [
      orgId,
      inc4Id,
      JSON.stringify([
        { cause: "KEYS * command executed by admin job", confidence: 0.90 },
        { cause: "Unbounded cache size eviction issues", confidence: 0.30 }
      ]),
      "Isolated the CPU spike to an internal cron execution running a KEYS * command. The cron job has been adjusted to use SCAN instead."
    ]
  );
  const inv4Id = inv4.rows[0].investigation_id;

  await queryDsql(
    `INSERT INTO root_causes (org_id, investigation_id, category, description, confidence)
     VALUES ($1, $2, 'Redis CPU Spike', 'A developer query executed KEYS * on production database, blocking the main single-threaded execution loop.', 0.90);`,
    [orgId, inv4Id]
  );
  console.log("✓ Seeded incident 4 (Medium, Resolved)");

  // Incident 5: Low (RESOLVED)
  await queryDsql(
    `INSERT INTO incidents (org_id, title, description, severity, status, resolved_at)
     VALUES ($1, 'Slow load times on public landing page', 'P99 load latency spiked to 3.2s. Static asset caching seems disabled.', 'LOW', 'RESOLVED', CURRENT_TIMESTAMP - INTERVAL '3 days');`,
    [orgId]
  );
  console.log("✓ Seeded incident 5 (Low, Resolved)");

  console.log("✓ Seeding database complete!");
}

seed().catch((err) => {
  console.error("Failed to seed database:", err);
  process.exit(1);
});
