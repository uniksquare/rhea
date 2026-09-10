// Seed the built-in Role catalog (see docs/naming-and-concepts.md).
//
//   npx tsx lib/seed-roles.ts
import dotenv from "dotenv";
import { prisma } from "./db";

dotenv.config({ path: ".env.local" });

const roles = [
  {
    roleKey: "on-call-engineer",
    name: "On-call Engineer",
    description:
      "Investigates incidents, ranks root causes, and proposes remediations for ops connectors.",
    manifest: {
      brain: { harness: "gemini", model: "vertex" },
      workspace: { type: "ops-connectors" },
      playbooks: [],
      tools: ["investigate", "remediate", "notify"],
      signoff: { remediate: true, notify: false },
    },
  },
  {
    roleKey: "web-developer",
    name: "Web Developer",
    description:
      "Edits static/HTML sites, previews changes, opens PRs, and publishes to the assignment's publish target.",
    manifest: {
      brain: { harness: "claude", model: "claude" },
      workspace: { type: "static-html-repo" },
      playbooks: [],
      tools: ["edit_site", "preview", "open_pr", "publish"],
      signoff: { publish: true },
    },
  },
];

async function run() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleKey: role.roleKey },
      update: {
        name: role.name,
        description: role.description,
        manifest: role.manifest,
      },
      create: role,
    });
    console.log(`✓ Seeded role: ${role.roleKey}`);
  }
  console.log("✓ Role seeding complete!");
}

run()
  .catch((err) => {
    console.error("Failed to seed roles:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
