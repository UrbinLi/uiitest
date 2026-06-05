import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export type StepStatus = "passed" | "failed" | "blocked" | "skipped";

export interface EvidenceRecorder {
  caseEvidenceDir: string;
  step(name: string, status: StepStatus, detail?: string): Promise<void>;
  consoleError(message: string): Promise<void>;
  pageError(message: string | Error): Promise<void>;
  screenshot(page: Page, name: string): Promise<string>;
  finish(status?: StepStatus, detail?: string): Promise<void>;
}

interface CreateEvidenceRecorderInput {
  evidenceRoot: string;
  caseId: string;
}

export async function createEvidenceRecorder({
  evidenceRoot,
  caseId,
}: CreateEvidenceRecorderInput): Promise<EvidenceRecorder> {
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
      const screenshotPath = join(caseEvidenceDir, `${name}.png`);

      await page.screenshot({ path: screenshotPath });

      return screenshotPath;
    },
    async finish(status = "passed", detail) {
      await appendStep("finish", status, detail);
    },
  };
}

function formatLogMessage(message: string | Error): string {
  const value = message instanceof Error ? message.stack ?? message.message : message;

  return value.replace(/\r?\n/g, "\\n");
}
