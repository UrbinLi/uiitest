import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeCaseRecord } from "../cases/schema.js";
import { createRunId, writeSnapshot } from "../cases/snapshot.js";
import type { StandardCase } from "../cases/types.js";
import { createFeishuClient } from "../feishu/client.js";
import { syncFeishuCases } from "../feishu/sync.js";
import { parseArgs } from "./args.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const runId = getStringArg(args.runId) ?? getEnv("QA_RUN_ID") ?? createRunId();
  const source = getStringArg(args.source) ?? "local";
  const sourceRef =
    getStringArg(args.input) ??
    getEnv("QA_CASE_SOURCE") ??
    "cases/examples/content-readonly.case.json";
  const cases =
    source === "feishu" ? await readFeishuCases(args) : await readLocalCases(rootDir, sourceRef);
  const snapshotPath = await writeSnapshot({
    rootDir,
    runId,
    source: source === "feishu" ? "feishu" : "local",
    sourceRef,
    filters: args,
    cases,
  });

  console.log(`QA_RUN_ID=${runId}`);
  console.log(`QA_CASE_SNAPSHOT=${snapshotPath}`);
}

async function readFeishuCases(args: Record<string, string | boolean>): Promise<StandardCase[]> {
  return syncFeishuCases(
    createFeishuClient({
      appToken: requireEnv("FEISHU_APP_TOKEN"),
      tableId: requireEnv("FEISHU_TABLE_ID"),
      bearerToken: requireEnv("FEISHU_BEARER_TOKEN"),
    }),
    getStringArg(args.viewId) ?? getEnv("FEISHU_VIEW_ID"),
  );
}

async function readLocalCases(rootDir: string, sourceRef: string): Promise<StandardCase[]> {
  const sourcePath = resolve(rootDir, sourceRef);
  const records = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;

  if (!Array.isArray(records)) {
    throw new Error(`Local case source must be a JSON array: ${sourceRef}`);
  }

  return records.map(normalizeCaseRecord);
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
