import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import type { CaseStatus } from "../cases/types.js";
import { createFeishuClient } from "../feishu/client.js";
import { writeCaseResult } from "../feishu/writeback.js";
import { updateWritebackStatus } from "../reporting/summary.js";
import { parseArgs } from "./args.js";

const CASE_STATUSES = new Set<CaseStatus>(["passed", "failed", "blocked", "skipped", "partial"]);

type SummaryFile = {
  runId: string;
  results: unknown[];
};

type WritebackResult = {
  feishuRecordId: string;
  status: CaseStatus;
  failure?: string;
  evidenceDir: string;
  finishedAt: string;
};

async function main(): Promise<void> {
  if (process.env.QA_FEISHU_WRITEBACK !== "1") {
    console.log("Feishu writeback disabled");
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const summaryPath = getStringArg(args.summary) ?? getEnv("QA_SUMMARY_PATH");
  if (summaryPath === undefined) {
    throw new Error("summary path is required");
  }

  const reportDir = dirname(summaryPath);

  try {
    const summary = await readSummary(summaryPath);
    const client = createFeishuClient({
      appToken: requireEnv("FEISHU_APP_TOKEN"),
      tableId: requireEnv("FEISHU_TABLE_ID"),
      bearerToken: requireEnv("FEISHU_BEARER_TOKEN"),
    });

    for (const [index, result] of summary.results.entries()) {
      const writebackResult = getWritebackResult(result, index);
      if (writebackResult === undefined) {
        continue;
      }

      await writeCaseResult(client, writebackResult.feishuRecordId, {
        runId: summary.runId,
        status: writebackResult.status,
        failure: writebackResult.failure,
        evidenceUrl: writebackResult.evidenceDir,
        executedAt: writebackResult.finishedAt,
      });
    }

    await updateWritebackStatus(reportDir, "passed");
  } catch (error) {
    await updateWritebackStatus(reportDir, "failed").catch(() => undefined);
    throw error;
  }
}

async function readSummary(summaryPath: string): Promise<SummaryFile> {
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as unknown;
  if (!isRecord(summary) || typeof summary.runId !== "string" || !Array.isArray(summary.results)) {
    throw new Error(`Invalid summary JSON: ${summaryPath}`);
  }

  return {
    runId: summary.runId,
    results: summary.results,
  };
}

function getWritebackResult(result: unknown, index: number): WritebackResult | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  const feishuRecordId = getOptionalNonEmptyString(result.feishuRecordId);
  if (feishuRecordId === undefined) {
    return undefined;
  }

  const status = getCaseStatus(result.status, index);
  const failure = getOptionalString(result.failure);
  const evidenceDir = requireString(result.evidenceDir, `results[${index}].evidenceDir`);
  const finishedAt = requireString(result.finishedAt, `results[${index}].finishedAt`);

  return {
    feishuRecordId,
    status,
    ...(failure === undefined ? {} : { failure }),
    evidenceDir,
    finishedAt,
  };
}

function getCaseStatus(value: unknown, index: number): CaseStatus {
  if (typeof value === "string" && CASE_STATUSES.has(value as CaseStatus)) {
    return value as CaseStatus;
  }

  throw new Error(`Invalid summary result status at index ${index}`);
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  return value;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getOptionalNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getStringArg(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (value === undefined) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
