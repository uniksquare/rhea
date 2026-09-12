// Initialise the Neon Postgres schema.
//
// The schema now lives in prisma/schema.prisma; this script is a convenience
// wrapper around `prisma db push` (equivalent to `npm run db:push`) that also
// loads .env.local and seeds the default organization, matching what the old
// DSQL init script did.
//
//   npx tsx lib/init-db.ts
import { execSync } from "node:child_process";
import dotenv from "dotenv";
import { prisma, queryDb } from "./db";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

async function run() {
  console.log("Pushing prisma/schema.prisma to the database (prisma db push)...");
  execSync("npx prisma db push", { stdio: "inherit", env: process.env });
  console.log("✓ Database schema is up to date!");

  await queryDb(
    `INSERT INTO organizations (name)
     SELECT 'Rhea Default Org'
     WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);`
  );

  const res = await queryDb("SELECT * FROM organizations ORDER BY created_at LIMIT 1;");
  console.log("Active Organization:", res.rows[0]);
}

run()
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
