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
  it("writes JSON and Markdown summaries with spec-shaped counts and case results", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "midscene-summary-"));

    const paths = await writeRunSummary({
      reportDir,
      runId: "run-2026-06-05",
      startedAt: "2026-06-05T10:00:00.000Z",
      finishedAt: "2026-06-05T10:00:02.000Z",
      results: [buildResult()],
      writebackStatus: "disabled",
    });

    const summary = JSON.parse(await readFile(paths.jsonPath, "utf8"));
    const markdown = await readFile(paths.markdownPath, "utf8");
    const expectedMarkdown = [
      "# UI Automation Run Summary",
      "",
      "- Run ID: run-2026-06-05",
      "- Passed: 1",
      "- Failed: 0",
      "- Blocked: 0",
      "- Skipped: 0",
      "- Partial: 0",
      "- Feishu writeback: disabled",
      "",
      "| Case ID | Module | Status | Evidence | Failure |",
      "| --- | --- | --- | --- | --- |",
      "| CONTENT-READ-001 | content-management | passed | /tmp/evidence/CONTENT-READ-001 |  |",
      "",
    ].join("\n");

    assert.equal(summary.counts.passed, 1);
    assert.equal(markdown, expectedMarkdown);
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

    assert.match(
      markdown,
      /^\| CONTENT-READ-001 \| content-management \| failed \| \/tmp\/evidence\/CONTENT-READ-001 \| Expected A \\\| B to be visible \|$/m,
    );
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

    const result = await updateWritebackStatus(reportDir, "passed");

    const summary = JSON.parse(await readFile(join(reportDir, "summary.json"), "utf8"));
    const markdown = await readFile(join(reportDir, "summary.md"), "utf8");

    assert.equal(result, undefined);
    assert.equal(summary.writebackStatus, "passed");
    assert.match(markdown, /^- Feishu writeback: passed$/m);
  });
});
