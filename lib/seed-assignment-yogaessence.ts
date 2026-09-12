// Seed the "Yoga Essence Site" Assignment (Web Developer role) for the dev org.
// Idempotent: skips when an assignment with that name already exists for the org.
//
//   npx tsx lib/seed-assignment-yogaessence.ts
//
// FTP host/port/user come from the yogaessence repo's .env; the password
// (FTP_PASS) is passed only via `secrets` so it lands encrypted in
// assignments.secrets_enc and never in assignments.config. It is never printed.
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { createAssignment } from "./platform";
import type { AssignmentConfig } from "./assignment-types";

dotenv.config({ path: ".env.local" });

const ASSIGNMENT_NAME = "Yoga Essence Site";
const WORKSPACE_PATH = "/Users/soubhagyapanda/Desktop/gitrepos/yogaessence";
const BASE_URL = "https://www.yogaessencerishikesh.com/shared";

/** Read the yogaessence .env without leaking it into process.env. */
function readWorkspaceEnv(): Record<string, string> {
  const file = path.join(WORKSPACE_PATH, ".env");
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return dotenv.parse(fs.readFileSync(file, "utf8"));
}

async function run() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found; sign in once to create the dev org.");

  const existing = await prisma.assignment.findFirst({
    where: { orgId: org.orgId, name: ASSIGNMENT_NAME },
  });
  if (existing) {
    console.log(`Assignment "${ASSIGNMENT_NAME}" already exists: ${existing.assignmentId}`);
    return;
  }

  const env = readWorkspaceEnv();
  const host = env.FTP_HOST;
  const user = env.FTP_USER;
  const pass = env.FTP_PASS;
  const port = env.FTP_PORT ? Number(env.FTP_PORT) : undefined;
  if (!host || !user || !pass) {
    throw new Error("yogaessence/.env must define FTP_HOST, FTP_USER, and FTP_PASS");
  }
  if (port !== undefined && !Number.isInteger(port)) {
    throw new Error("FTP_PORT must be an integer");
  }

  // The password is deliberately absent from config; it goes through `secrets`.
  const config = {
    repoUrl: "local",
    workspacePath: WORKSPACE_PATH,
    siteDir: "shared",
    baseBranch: "main",
    publishTarget: {
      type: "hostinger-ftp",
      host,
      ...(port !== undefined ? { port } : {}),
      user,
      remoteDir: ".",
      baseUrl: BASE_URL,
    },
    allowedTools: ["Read", "Edit", "Write", "Glob", "Grep"],
  } as unknown as AssignmentConfig;

  const row = await createAssignment({
    orgId: org.orgId,
    roleKey: "web-developer",
    name: ASSIGNMENT_NAME,
    config,
    secrets: { publishPass: pass },
  });

  console.log(`Created assignment "${ASSIGNMENT_NAME}" for org ${org.orgId}`);
  console.log(`assignmentId: ${row.assignmentId}`);
}

run()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
