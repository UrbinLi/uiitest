import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const runId = process.env.QA_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = process.env.QA_EVIDENCE_DIR || path.join("qa", "evidence", runId);
const reportDir = process.env.QA_REPORT_DIR || path.join("qa", "reports", runId);

test("WEB-SMOKE-001 public login page renders without browser errors", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });

  await mkdir(evidenceDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  await expect(page.locator("#root")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Log in|Login|登录)$/i })).toBeVisible();

  const screenshotPath = path.join(evidenceDir, "WEB-SMOKE-001-login-page.png");
  const consoleLogPath = path.join(evidenceDir, "WEB-SMOKE-001-console-errors.log");
  const pageErrorPath = path.join(evidenceDir, "WEB-SMOKE-001-page-errors.log");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(consoleLogPath, consoleErrors.join("\n"), "utf8");
  await writeFile(pageErrorPath, pageErrors.join("\n"), "utf8");

  await writeFile(
    path.join(reportDir, "smoke-summary.md"),
    [
      "# Web QA Smoke Summary",
      "",
      `- Run ID: ${runId}`,
      "- Scenario: WEB-SMOKE-001 public login page renders without browser errors",
      `- Browser: ${testInfo.project.name}`,
      `- URL: ${page.url()}`,
      `- Screenshot: ${screenshotPath}`,
      `- Console errors: ${consoleErrors.length}`,
      `- Page errors: ${pageErrors.length}`,
      ""
    ].join("\n"),
    "utf8"
  );

  expect(consoleErrors, `Console errors written to ${consoleLogPath}`).toEqual([]);
  expect(pageErrors, `Page errors written to ${pageErrorPath}`).toEqual([]);
});
