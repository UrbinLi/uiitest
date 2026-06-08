import { PlaywrightAgent } from "@midscene/web/playwright";
import { test } from "@playwright/test";
import { runAiAssertions } from "../../src/assertions/ai.js";
import { runHardAssertions } from "../../src/assertions/hard.js";
import { readSnapshot } from "../../src/cases/snapshot.js";
import type { CaseResult, SafetyLevel, StandardCase } from "../../src/cases/types.js";
import { getDataProfile } from "../../src/data-profiles/registry.js";
import { createEvidenceRecorder } from "../../src/evidence/recorder.js";
import { writeRunSummary } from "../../src/reporting/summary.js";
import { selectCases } from "../../src/runner/filters.js";
import { safetyDecision } from "../../src/safety/safety.js";

const snapshotPath = process.env.QA_CASE_SNAPSHOT;
const evidenceRoot = process.env.QA_EVIDENCE_DIR || "qa/evidence/local";
const reportDir = process.env.QA_REPORT_DIR || "qa/reports/local";
const allowedSafety = parseAllowedSafety(process.env.QA_ALLOWED_SAFETY);

if (!snapshotPath) {
  throw new Error("QA_CASE_SNAPSHOT is required");
}

const snapshot = await readSnapshot(snapshotPath);
const selected = selectCases(snapshot.cases, {
  module: process.env.QA_MODULE,
  feature: process.env.QA_FEATURE,
  caseId: process.env.QA_CASE_ID,
  tags: process.env.QA_TAGS ? process.env.QA_TAGS.split(",").filter(Boolean) : undefined,
  priority: process.env.QA_PRIORITY,
  env: process.env.QA_ENV,
});

const runResults: CaseResult[] = [];

test.afterAll(async () => {
  await writeRunSummary({
    reportDir,
    runId: snapshot.runId,
    startedAt: snapshot.createdAt,
    finishedAt: new Date().toISOString(),
    results: runResults,
    writebackStatus: process.env.QA_FEISHU_WRITEBACK === "1" ? "pending" : "disabled",
  });
});

for (const excluded of selected.excluded) {
  test(`${excluded.testCase.caseId} skipped: ${excluded.reason}`, async () => {
    const now = new Date().toISOString();
    runResults.push({
      caseId: excluded.testCase.caseId,
      feishuRecordId: excluded.testCase.feishuRecordId,
      module: excluded.testCase.module,
      title: excluded.testCase.title,
      status: "skipped",
      durationMs: 0,
      failure: excluded.reason,
      evidenceDir: `${evidenceRoot}/${excluded.testCase.caseId}`,
      startedAt: now,
      finishedAt: now,
    });
  });
}

for (const testCase of selected.included) {
  test(`${testCase.caseId} ${testCase.title}`, async ({ page }) => {
    const startedAt = new Date();
    const recorder = await createEvidenceRecorder({ evidenceRoot, caseId: testCase.caseId });

    page.on("console", (message) => {
      if (message.type() === "error") {
        void recorder.consoleError(message.text());
      }
    });
    page.on("pageerror", (error) => {
      void recorder.pageError(error.stack || error.message);
    });

    const safety = safetyDecision(testCase.safetyLevel, allowedSafety);
    if (!safety.allowed) {
      await recorder.step("safety gate", "skipped", safety.reason);
      await recorder.finish();
      recordResult(testCase, "skipped", startedAt, recorder.caseEvidenceDir, safety.reason);
      return;
    }

    const profile = getDataProfile(testCase.dataProfile);

    try {
      await recorder.step(
        "data profile setup",
        "passed",
        JSON.stringify(await profile.setup({ runId: snapshot.runId, caseId: testCase.caseId })),
      );

      for (const step of testCase.steps) {
        const agent = new PlaywrightAgent(page);
        await recorder.step(`step ${step.type}`, "passed", JSON.stringify(step));

        if (step.type === "goto" && step.target) {
          await page.goto(step.target, { waitUntil: "domcontentloaded" });
        } else if (step.type === "click" && step.target) {
          await page.locator(step.target).click();
        } else if (step.type === "fill" && step.target) {
          await page.locator(step.target).fill(step.value || step.input || "");
        } else if (step.type === "wait_for" && step.target) {
          await page.locator(step.target).waitFor({ timeout: step.timeoutMs });
        } else if (step.type === "ai_act" && step.note) {
          await agent.aiAct(step.note);
        } else if (step.type === "ai_query") {
          await agent.aiQuery(step.note || step.target || "Summarize the current visible page state.");
        } else if (step.type === "manual_note") {
          await recorder.step("manual note", "passed", step.note || "");
        } else if (step.type === "api_check") {
          throw new Error("api_check steps require a module-specific API helper and are not supported by the generic browser runner");
        } else {
          throw new Error(`Invalid step configuration for ${step.type}`);
        }
      }

      await runHardAssertions(page, testCase.hardAssertions);
      await runAiAssertions(testCase.aiAssertions, {
        aiAssert: async (prompt) => {
          await new PlaywrightAgent(page).aiAssert(prompt);
        },
      });
      await recorder.screenshot(page, "final");
      await recorder.step("assertions", "passed");
      await recorder.step(
        "data profile cleanup",
        "passed",
        JSON.stringify(await profile.cleanup({ runId: snapshot.runId, caseId: testCase.caseId })),
      );
      await recorder.finish();
      recordResult(testCase, "passed", startedAt, recorder.caseEvidenceDir);
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      await recorder.screenshot(page, "failure").catch(() => undefined);
      await recorder.step("case failed", "failed", failure);
      await recorder.finish();
      recordResult(testCase, "failed", startedAt, recorder.caseEvidenceDir, failure);
      throw error;
    }
  });
}

function recordResult(
  testCase: StandardCase,
  status: CaseResult["status"],
  startedAt: Date,
  evidenceDir: string,
  failure?: string,
): void {
  const finishedAt = new Date();
  runResults.push({
    caseId: testCase.caseId,
    feishuRecordId: testCase.feishuRecordId,
    module: testCase.module,
    title: testCase.title,
    status,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    failure,
    evidenceDir,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  });
}

function parseAllowedSafety(value: string | undefined): SafetyLevel {
  if (value === "dangerous-write" || value === "controlled-write") {
    return value;
  }

  return "readonly";
}
