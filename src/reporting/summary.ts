import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaseResult, CaseStatus } from "../cases/types.js";

export type WritebackStatus = "disabled" | "pending" | "passed" | "failed";

export interface RunSummaryInput {
  reportDir: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  results: CaseResult[];
  writebackStatus: WritebackStatus;
}

interface RunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  counts: Record<CaseStatus, number>;
  writebackStatus: WritebackStatus;
  results: CaseResult[];
}

const CASE_STATUSES: CaseStatus[] = ["passed", "failed", "blocked", "skipped", "partial"];

export async function writeRunSummary(input: RunSummaryInput): Promise<{
  jsonPath: string;
  markdownPath: string;
}> {
  const jsonPath = join(input.reportDir, "summary.json");
  const markdownPath = join(input.reportDir, "summary.md");
  const summary = buildRunSummary(input);

  await mkdir(input.reportDir, { recursive: true });
  await writeSummaryFiles(summary, jsonPath, markdownPath);

  return { jsonPath, markdownPath };
}

export async function updateWritebackStatus(
  reportDir: string,
  status: WritebackStatus,
): Promise<void> {
  const jsonPath = join(reportDir, "summary.json");
  const markdownPath = join(reportDir, "summary.md");
  const summary = JSON.parse(await readFile(jsonPath, "utf8")) as RunSummary;

  summary.writebackStatus = status;
  summary.counts = countResults(summary.results);

  await writeSummaryFiles(summary, jsonPath, markdownPath);
}

function buildRunSummary(input: RunSummaryInput): RunSummary {
  return {
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    counts: countResults(input.results),
    writebackStatus: input.writebackStatus,
    results: input.results,
  };
}

async function writeSummaryFiles(
  summary: RunSummary,
  jsonPath: string,
  markdownPath: string,
): Promise<void> {
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(markdownPath, renderMarkdown(summary)),
  ]);
}

function countResults(results: CaseResult[]): Record<CaseStatus, number> {
  const counts = Object.fromEntries(CASE_STATUSES.map((status) => [status, 0])) as Record<
    CaseStatus,
    number
  >;

  for (const result of results) {
    counts[result.status] += 1;
  }

  return counts;
}

function renderMarkdown(summary: RunSummary): string {
  const lines = [
    "# UI Automation Run Summary",
    "",
    `- Run ID: ${summary.runId}`,
    `- Passed: ${summary.counts.passed}`,
    `- Failed: ${summary.counts.failed}`,
    `- Blocked: ${summary.counts.blocked}`,
    `- Skipped: ${summary.counts.skipped}`,
    `- Partial: ${summary.counts.partial}`,
    `- Feishu writeback: ${summary.writebackStatus}`,
    "",
    "| Case ID | Module | Status | Evidence | Failure |",
    "| --- | --- | --- | --- | --- |",
    ...summary.results.map(renderResultRow),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function renderResultRow(result: CaseResult): string {
  return [
    result.caseId,
    result.module,
    result.status,
    result.evidenceDir,
    result.failure ?? "",
  ]
    .map(escapeTableCell)
    .join(" | ")
    .replace(/^/, "| ")
    .replace(/$/, " |");
}

function escapeTableCell(value: string): string {
  return value.replace(/\r?\n/g, "<br>").replaceAll("|", "\\|");
}
