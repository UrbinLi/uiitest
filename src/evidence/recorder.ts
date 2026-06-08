import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export type StepStatus = "passed" | "failed" | "blocked" | "skipped";

const EVIDENCE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export interface EvidenceRecorder {
  caseEvidenceDir: string;
  step(name: string, status: StepStatus, detail?: string): Promise<void>;
  consoleError(message: string): Promise<void>;
  pageError(message: string): Promise<void>;
  screenshot(page: Page, name: string): Promise<string>;
  finish(): Promise<void>;
}

interface CreateEvidenceRecorderInput {
  evidenceRoot: string;
  caseId: string;
}

export async function createEvidenceRecorder({
  evidenceRoot,
  caseId,
}: CreateEvidenceRecorderInput): Promise<EvidenceRecorder> {
  assertValidEvidencePathSegment(caseId);

  const caseEvidenceDir = join(evidenceRoot, caseId);
  const stepsPath = join(caseEvidenceDir, "steps.jsonl");
  const consoleErrorsPath = join(caseEvidenceDir, "console-errors.log");
  const pageErrorsPath = join(caseEvidenceDir, "page-errors.log");

  await mkdir(caseEvidenceDir, { recursive: true });
  await Promise.all([
    writeFile(stepsPath, ""),
    writeFile(consoleErrorsPath, ""),
    writeFile(pageErrorsPath, ""),
  ]);

  const appendStep = async (name: string, status: StepStatus, detail?: string): Promise<void> => {
    const entry = {
      at: new Date().toISOString(),
      name,
      status,
      ...(detail === undefined ? {} : { detail }),
    };

    await appendFile(stepsPath, `${JSON.stringify(entry)}\n`);
  };

  return {
    caseEvidenceDir,
    async step(name, status, detail) {
      await appendStep(name, status, detail);
    },
    async consoleError(message) {
      await appendFile(consoleErrorsPath, `${formatLogMessage(message)}\n`);
    },
    async pageError(message) {
      await appendFile(pageErrorsPath, `${formatLogMessage(message)}\n`);
    },
    async screenshot(page, name) {
      assertValidEvidencePathSegment(name);

      const screenshotPath = join(caseEvidenceDir, `${name}.png`);

      await page.screenshot({ path: screenshotPath, fullPage: true });

      return screenshotPath;
    },
    async finish() {
      await appendStep("finish evidence recording", "passed");
    },
  };
}

function assertValidEvidencePathSegment(segment: string): void {
  if (
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    !EVIDENCE_PATH_SEGMENT_PATTERN.test(segment)
  ) {
    throw new Error(`Invalid evidence path segment: ${segment}`);
  }
}

function formatLogMessage(message: string): string {
  return message.replace(/\r?\n/g, "\\n");
}
