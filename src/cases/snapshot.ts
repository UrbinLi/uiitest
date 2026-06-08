import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CaseSnapshot, StandardCase } from "./types.js";

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function createRunId(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = padDatePart(now.getUTCMonth() + 1);
  const day = padDatePart(now.getUTCDate());
  const hours = padDatePart(now.getUTCHours());
  const minutes = padDatePart(now.getUTCMinutes());
  const seconds = padDatePart(now.getUTCSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export async function writeSnapshot(input: {
  rootDir: string;
  runId: string;
  source: CaseSnapshot["source"];
  sourceRef: string;
  filters: CaseSnapshot["filters"];
  cases: StandardCase[];
}): Promise<string> {
  if (!RUN_ID_PATTERN.test(input.runId)) {
    throw new Error(`Invalid run ID: ${input.runId}`);
  }

  const snapshotDir = join(input.rootDir, "cases", "snapshots", input.runId);
  const snapshotPath = join(snapshotDir, "cases.json");
  const snapshot: CaseSnapshot = {
    runId: input.runId,
    createdAt: new Date().toISOString(),
    source: input.source,
    sourceRef: input.sourceRef,
    filters: input.filters,
    cases: input.cases,
  };

  await mkdir(snapshotDir, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return snapshotPath;
}

export async function readSnapshot(snapshotPath: string): Promise<CaseSnapshot> {
  return JSON.parse(await readFile(snapshotPath, "utf8")) as CaseSnapshot;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
