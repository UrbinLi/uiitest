import { strict as assert } from "node:assert";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { updateWritebackStatus, writeRunSummary } from "../../src/reporting/summary.js";
import type { CaseResult } from "../../src/cases/types.js";

function buildResult(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: "CONTENT-READ-001",
    module: "content-management",
    title: "Readonly content page loads",
    status: "passed",
    durationMs: 1200,
    evidenceDir: "/tmp/evidence/CONTENT-READ-001",
    startedAt: "2026-06-05T10:00:00.000Z",
    finishedAt: "2026-06-05T10:00:01.200Z",
    ...overrides,
  };
}

describe("run summary reporting", () => {
  it("writes JSON and Markdown summaries with counts and case results", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "midscene-summary-"));

    const paths = await writeRunSummary({
      reportDir,
      runId: "run-2026-06-05",
      startedAt: "2026-06-05T10:00:00.000Z",
      finishedAt: "2026-06-05T10:00:02.000Z",
      results: [buildResult()],
      writebackStatus: "pending",
    });

    const summary = JSON.parse(await readFile(paths.jsonPath, "utf8"));
    const markdown = await readFile(paths.markdownPath, "utf8");

    assert.equal(summary.counts.passed, 1);
    assert.match(markdown, /\| passed \| 1 \|/);
    assert.match(markdown, /\| failed \| 0 \|/);
    assert.match(markdown, /CONTENT-READ-001/);
  });

  it("escapes pipe characters in failure text in Markdown result tables", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "midscene-summary-"));

    const { markdownPath } = await writeRunSummary({
      reportDir,
      runId: "run-2026-06-05",
      startedAt: "2026-06-05T10:00:00.000Z",
      finishedAt: "2026-06-05T10:00:02.000Z",
      results: [
        buildResult({
          status: "failed",
          failure: "Expected A | B to be visible",
        }),
      ],
      writebackStatus: "pending",
    });

    const markdown = await readFile(markdownPath, "utf8");

    assert.match(markdown, /Expected A \\| B to be visible/);
  });

  it("updates JSON and Markdown Feishu writeback status", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "midscene-summary-"));

    await writeRunSummary({
      reportDir,
      runId: "run-2026-06-05",
      startedAt: "2026-06-05T10:00:00.000Z",
      finishedAt: "2026-06-05T10:00:02.000Z",
      results: [buildResult()],
      writebackStatus: "pending",
    });

    await updateWritebackStatus(reportDir, "passed");

    const summary = JSON.parse(await readFile(join(reportDir, "summary.json"), "utf8"));
    const markdown = await readFile(join(reportDir, "summary.md"), "utf8");

    assert.equal(summary.writebackStatus, "passed");
    assert.match(markdown, /Feishu writeback status: passed/);
  });
});
