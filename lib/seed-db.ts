import { queryDsql } from "./dsql";
import { seedOrg } from "./seed-org";

async function seed() {
  console.log("Connecting to database for seeding...");
  
  // Get all organizations in the database
  const orgRes = await queryDsql("SELECT org_id, name FROM organizations;");
  if (orgRes.rows.length === 0) {
    console.log("No organization found. Creating default...");
    const newOrg = await queryDsql("INSERT INTO organizations (name) VALUES ('Rhea Default Org') RETURNING org_id;");
    const orgId = newOrg.rows[0].org_id;
    await seedOrg(orgId, 'Rhea Default Org');
  } else {
    console.log(`Found ${orgRes.rows.length} organization(s). Seeding all...`);
    for (const org of orgRes.rows) {
      await seedOrg(org.org_id, org.name);
    }
  }

  console.log("✓ Database seeding complete!");
}

seed().catch((err) => {
  console.error("Failed to seed database:", err);
  process.exit(1);
});
