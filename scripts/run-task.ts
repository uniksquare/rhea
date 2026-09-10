// Exercise the Web Developer libs directly, without Eve.
//
//   npx tsx scripts/run-task.ts --assignment <id> --request "<text>" [--dry-run|--deploy] [--harness]
//
// Flow: createTask -> updateTask(planning) -> ensureBranch(task/<id8>)
//       -> [--harness] runHarness + commitAll(siteDir) + recordUsage
//       -> [--deploy] deployPreview + updateTask(previewed), else print the plan.
// Default is dry-run: nothing leaves this machine unless --deploy is passed.
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/db";
import {
  createTask,
  updateTask,
  recordUsage,
  resolveAssignmentConfig,
} from "../lib/platform";
import { ensureBranch, commitAll } from "../lib/github";
import { runHarness } from "../lib/harness";
import { deployPreview, slug, siteDirOf } from "../lib/previewer";
import type { AssignmentConfig } from "../lib/assignment-types";

dotenv.config({ path: ".env.local" });

// Same derivation as agent/subagents/web-developer/tools/edit_site.ts.
function branchForTask(taskId: string): string {
  const short = taskId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `task/${short}`;
}

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

function parseArgs(argv: string[]) {
  const out = { assignment: "", request: "", deploy: false, harness: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--assignment") out.assignment = argv[++i] ?? "";
    else if (a === "--request") out.request = argv[++i] ?? "";
    else if (a === "--deploy") out.deploy = true;
    else if (a === "--dry-run") out.deploy = false;
    else if (a === "--harness") out.harness = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!out.assignment || !out.request) {
    throw new Error(
      'Usage: npx tsx scripts/run-task.ts --assignment <id> --request "<text>" [--dry-run|--deploy] [--harness]'
    );
  }
  return out;
}

/** Init a local-only git repo (branch main) when the workspace is not one yet. */
function ensureLocalRepo(workspacePath: string, baseBranch: string) {
  if (fs.existsSync(path.join(workspacePath, ".git"))) return;
  const gitignore = path.join(workspacePath, ".gitignore");
  const wanted = [".env", ".DS_Store"];
  const lines = fs.existsSync(gitignore)
    ? fs.readFileSync(gitignore, "utf8").split(/\r?\n/).map((l) => l.trim())
    : [];
  const missing = wanted.filter((w) => !lines.includes(w));
  if (missing.length) {
    const prefix = lines.length && lines[lines.length - 1] !== "" ? "\n" : "";
    fs.appendFileSync(gitignore, `${prefix}${missing.join("\n")}\n`);
  }
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: workspacePath, stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
  git(["init", "-b", baseBranch]);
  git(["add", "-A"]);
  git(["commit", "-m", "chore: initial import"]);
  console.log(`git: initialised local repo at ${workspacePath} on ${baseBranch}`);
}

/** What deployPreview would mirror, without touching the network. */
function previewPlan(config: AssignmentConfig, branch: string) {
  const target = config.publishTarget;
  if (target.type !== "hostinger-ftp") {
    return { localDir: siteDirOf(config), remoteDir: "(vercel: not implemented)", url: "(vercel)" };
  }
  const s = slug(branch);
  const remoteDir = `${target.remoteDir.replace(/\/+$/, "")}/preview/${s}`;
  const url = `${target.baseUrl.replace(/\/+$/, "")}/preview/${s}/`;
  return { localDir: siteDirOf(config), remoteDir, url, host: target.host, user: target.user };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const row = await prisma.assignment.findFirst({ where: { assignmentId: args.assignment } });
  if (!row) throw new Error(`Assignment ${args.assignment} not found`);
  const orgId = row.orgId;
  const config = await resolveAssignmentConfig(row.assignmentId, orgId);
  const siteDir = config.siteDir ?? "shared";
  const baseBranch = config.baseBranch ?? "main";

  const task = await createTask({ orgId, assignmentId: row.assignmentId, request: args.request });
  const taskId = task.taskId;
  console.log(`task: ${taskId}`);

  try {
    await updateTask(taskId, orgId, { status: "planning" });

    ensureLocalRepo(config.workspacePath, baseBranch);
    const branch = branchForTask(taskId);
    await ensureBranch({ workspacePath: config.workspacePath, branch, base: baseBranch });
    await updateTask(taskId, orgId, { branch });
    console.log(`branch: ${branch}`);

    if (args.harness) {
      const prompt = [
        `You are making a scoped change to a website repo.`,
        `Only edit files inside the "${siteDir}" directory - never touch anything outside it.`,
        `Change request:`,
        args.request,
      ].join("\n\n");
      const harness = await runHarness({
        workspacePath: config.workspacePath,
        prompt,
        allowedTools: config.allowedTools,
        model: config.model,
      });
      if (!harness.ok) throw new Error(`harness failed: ${harness.output}`);
      const commit = await commitAll({
        workspacePath: config.workspacePath,
        message: `rhea: ${args.request.slice(0, 72)}`,
        paths: [siteDir],
      });
      await recordUsage({
        orgId,
        assignmentId: row.assignmentId,
        taskId,
        roleKey: "web-developer",
        tool: "run-task",
        provider: harness.provider,
        model: harness.model,
        inputTokens: harness.usage.inputTokens,
        outputTokens: harness.usage.outputTokens,
        cacheReadTokens: harness.usage.cacheReadTokens,
        cacheWriteTokens: harness.usage.cacheWriteTokens,
        costUsd: harness.usage.costUsd,
      });
      console.log(`harness: ok, changed=${commit.changed}, sha=${commit.sha}`);
      console.log(`harness summary: ${harness.output.slice(0, 300)}`);
    } else {
      console.log("harness skipped");
    }

    if (args.deploy) {
      const { url } = await deployPreview({ config, branch });
      await updateTask(taskId, orgId, { previewUrl: url, status: "previewed" });
      console.log(`preview url: ${url}`);
    } else {
      const plan = previewPlan(config, branch);
      console.log("dry-run: deployPreview would mirror (not called):");
      console.log(`  local  ${plan.localDir}`);
      console.log(`  remote ${plan.host ? `${plan.user}@${plan.host}:` : ""}${plan.remoteDir}`);
      console.log(`  url    ${plan.url}`);
    }
  } catch (err) {
    await updateTask(taskId, orgId, { status: "failed", error: errorText(err) });
    throw err;
  }
}

main()
  .catch((err) => {
    console.error(errorText(err));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
