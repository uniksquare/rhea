import { test } from "node:test";
import assert from "node:assert/strict";
import {
  branchForTask,
  buildTaskPrompt,
  isChatLocked,
  isChatClaimable,
  parsePlan,
  planFromOutput,
  planFromJson,
  loadJobDescription,
  errorText,
  TASK_MESSAGE_MAX,
} from "../lib/task-chat.ts";

test("branchForTask: task/<first 8 alnum chars>, same as edit_site", () => {
  assert.equal(branchForTask("3f2a9c1e-77b4-4d1b-9a2e-000000000000"), "task/3f2a9c1e");
  assert.equal(branchForTask("ab-cd-ef-gh-ij-kl"), "task/abcdefgh");
  assert.equal(branchForTask("abc"), "task/abc");
});

test("isChatLocked: published, discarded, publishing and working tasks reject messages", () => {
  for (const s of ["published", "discarded", "publishing", "working"]) assert.equal(isChatLocked(s), true, s);
  for (const s of ["requested", "planning", "previewed", "failed"]) assert.equal(isChatLocked(s), false, s);
});

test("isChatClaimable: only requested, planning, previewed and failed tasks can start a turn", () => {
  for (const s of ["requested", "planning", "previewed", "failed"]) assert.equal(isChatClaimable(s), true, s);
  for (const s of ["working", "publishing", "published", "discarded", "bogus"]) assert.equal(isChatClaimable(s), false, s);
});

test("errorText: truncates to 500 chars and handles non-Errors", () => {
  assert.equal(errorText(new Error("boom")), "boom");
  assert.equal(errorText("plain"), "plain");
  assert.equal(errorText(new Error("x".repeat(900))).length, 500);
});

test("parsePlan: bare JSON, fenced JSON, and prose-wrapped JSON all parse", () => {
  const plan = { summary: "s", edits: [{ file: "shared/index.html", change: "c" }], questions: ["q"] };
  const json = JSON.stringify(plan);
  assert.deepEqual(parsePlan(json), plan);
  assert.deepEqual(parsePlan("```json\n" + json + "\n```"), plan);
  assert.deepEqual(parsePlan("Here is the plan:\n" + json + "\nDone."), plan);
});

test("parsePlan: coerces missing or malformed fields", () => {
  const p = parsePlan(JSON.stringify({ summary: 1, edits: [{ file: "a" }, "junk", { change: "b" }, {}], questions: ["", "q", 2] }));
  assert.deepEqual(p, {
    summary: "1",
    edits: [
      { file: "a", change: "" },
      { file: "", change: "b" },
    ],
    questions: ["q", "2"],
  });
});

test("parsePlan: returns null for non-JSON, arrays and empty output", () => {
  assert.equal(parsePlan("no json here"), null);
  assert.equal(parsePlan("[1,2,3]"), null);
  assert.equal(parsePlan(""), null);
  assert.equal(parsePlan("{ not json }"), null);
});

test("planFromOutput: falls back to the raw output as the summary", () => {
  const p = planFromOutput("I could not decide.");
  assert.deepEqual(p, { summary: "I could not decide.", edits: [], questions: [] });
  assert.equal(planFromOutput("y".repeat(5000)).summary.length, 2000);
});

test("planFromJson: coerces a stored plan and rejects non-objects", () => {
  assert.equal(planFromJson(null), null);
  assert.equal(planFromJson("str"), null);
  assert.equal(planFromJson([1]), null);
  assert.deepEqual(planFromJson({ summary: "s" }), { summary: "s", edits: [], questions: [] });
  assert.deepEqual(planFromJson({ summary: "s", edits: [{ file: "f", change: "c" }], questions: ["q"] }), {
    summary: "s",
    edits: [{ file: "f", change: "c" }],
    questions: ["q"],
  });
});

const base = {
  jobDescription: "# Web Developer Subagent Instructions\n\nYou are rhea in the Web Developer Role.",
  siteDir: "shared",
  request: "Update the hero CTA",
  message: "Make it say Book now",
};

test("buildTaskPrompt: first turn prepends job description, siteDir rule and original request, in order", () => {
  const p = buildTaskPrompt({ ...base, firstTurn: true, mode: "edit" });
  const iJob = p.indexOf("# Your job description");
  const iDesc = p.indexOf("You are rhea in the Web Developer Role.");
  const iRule = p.indexOf('Only edit files inside the "shared" directory');
  const iReq = p.indexOf("# Original request for this Task\nUpdate the hero CTA");
  const iMode = p.indexOf("This turn makes the change.");
  const iMsg = p.indexOf("# Message from the client\nMake it say Book now");
  for (const [name, i] of Object.entries({ iJob, iDesc, iRule, iReq, iMode, iMsg })) {
    assert.ok(i >= 0, `${name} present`);
  }
  assert.ok(iJob < iDesc && iDesc < iRule && iRule < iReq && iReq < iMode && iMode < iMsg);
});

test("buildTaskPrompt: later turns send only the mode instructions and the message", () => {
  const p = buildTaskPrompt({ ...base, firstTurn: false, mode: "edit" });
  assert.ok(!p.includes("# Your job description"));
  assert.ok(!p.includes("# Original request for this Task"));
  assert.ok(p.includes('inside the "shared" directory'));
  assert.ok(p.endsWith("# Message from the client\nMake it say Book now"));
});

test("buildTaskPrompt: plan mode asks for the JSON plan shape and no edits", () => {
  const p = buildTaskPrompt({ ...base, firstTurn: true, mode: "plan" });
  assert.ok(p.includes("READ-ONLY planning pass"));
  assert.ok(p.includes('{ "summary": string, "edits": [{ "file": string, "change": string }], "questions": string[] }'));
  assert.ok(!p.includes("This turn makes the change."));
  const later = buildTaskPrompt({ ...base, firstTurn: false, mode: "plan" });
  assert.ok(later.includes("READ-ONLY planning pass"));
  assert.ok(!later.includes("# Your job description"));
});

test("buildTaskPrompt: honours a custom siteDir", () => {
  const p = buildTaskPrompt({ ...base, siteDir: "public", firstTurn: true, mode: "edit" });
  assert.ok(p.includes('Only edit files inside the "public" directory'));
  assert.ok(!p.includes('"shared"'));
});

test("loadJobDescription: reads the Web Developer instructions from the repo", async () => {
  const text = await loadJobDescription();
  assert.ok(text.startsWith("# Web Developer Subagent Instructions"));
  assert.ok(text.includes("siteDir"));
});

test("TASK_MESSAGE_MAX is 20000", () => {
  assert.equal(TASK_MESSAGE_MAX, 20000);
});
