import { strict as assert } from "node:assert";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Page } from "@playwright/test";

import { createEvidenceRecorder } from "../../src/evidence/recorder.js";
import type { EvidenceRecorder } from "../../src/evidence/recorder.js";

type FinishParameters = Parameters<EvidenceRecorder["finish"]>;
type FinishAcceptsNoArgumentsOnly = FinishParameters extends []
  ? [] extends FinishParameters
    ? true
    : false
  : false;

const finishAcceptsNoArgumentsOnly: FinishAcceptsNoArgumentsOnly = true;

describe("evidence recorder", () => {
  it("creates a case evidence directory and writes evidence logs", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "midscene-evidence-"));
    const caseId = "CONTENT-READ-001";

    const recorder = await createEvidenceRecorder({ evidenceRoot, caseId });

    assert.equal(finishAcceptsNoArgumentsOnly, true);

    const directory = await stat(join(evidenceRoot, caseId));
    assert.equal(directory.isDirectory(), true);
    assert.equal(recorder.caseEvidenceDir, join(evidenceRoot, caseId));

    await recorder.step("Open content page", "passed", "Loaded /content");
    await recorder.consoleError("TypeError: Cannot read property 'map' of undefined");
    await recorder.pageError("Page crashed while rendering content");
    await recorder.finish();

    const steps = await readFile(join(recorder.caseEvidenceDir, "steps.jsonl"), "utf8");
    const consoleErrors = await readFile(
      join(recorder.caseEvidenceDir, "console-errors.log"),
      "utf8",
    );
    const pageErrors = await readFile(join(recorder.caseEvidenceDir, "page-errors.log"), "utf8");

    const stepEntries = steps
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const finishEntry = stepEntries.at(-1);

    assert.match(steps, /Open content page/);
    assert.equal(finishEntry.name, "finish evidence recording");
    assert.equal(finishEntry.status, "passed");
    assert.match(consoleErrors, /Cannot read property 'map'/);
    assert.match(pageErrors, /Page crashed/);
  });

  it("rejects invalid case IDs before creating evidence paths", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "midscene-evidence-"));
    const invalidCaseIds = ["../outside", "foo/bar", ".", ""];

    for (const caseId of invalidCaseIds) {
      await assert.rejects(
        () => createEvidenceRecorder({ evidenceRoot, caseId }),
        /Invalid evidence path segment/,
      );
    }
  });

  it("captures full-page screenshots", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "midscene-evidence-"));
    const caseId = "CONTENT-READ-001";
    const recorder = await createEvidenceRecorder({ evidenceRoot, caseId });
    const screenshotCalls: unknown[] = [];
    const page = {
      async screenshot(options: unknown) {
        screenshotCalls.push(options);
        return Buffer.from("");
      },
    } as unknown as Page;

    const screenshotPath = await recorder.screenshot(page, "content-page");

    assert.equal(screenshotPath, join(recorder.caseEvidenceDir, "content-page.png"));
    assert.deepEqual(screenshotCalls, [{ path: screenshotPath, fullPage: true }]);
  });

  it("rejects invalid screenshot names before writing screenshots", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "midscene-evidence-"));
    const recorder = await createEvidenceRecorder({
      evidenceRoot,
      caseId: "CONTENT-READ-001",
    });
    const invalidScreenshotNames = ["../outside", "foo/bar", ".."];
    const screenshotCalls: unknown[] = [];
    const page = {
      async screenshot(options: unknown) {
        screenshotCalls.push(options);
        return Buffer.from("");
      },
    } as unknown as Page;

    for (const name of invalidScreenshotNames) {
      await assert.rejects(() => recorder.screenshot(page, name), /Invalid evidence path segment/);
    }

    assert.deepEqual(screenshotCalls, []);
  });
});
