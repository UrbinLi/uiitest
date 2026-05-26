import { expect, test } from "@playwright/test";
import { PlaywrightAgent } from "@midscene/web/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const runId = process.env.QA_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = process.env.QA_EVIDENCE_DIR || path.join("qa", "evidence", runId);
const reportDir = process.env.QA_REPORT_DIR || path.join("qa", "reports", runId);

test("WEB-AI-001 public login page communicates a usable login path", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let status = "failed";
  let failure = "";

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

  const screenshotPath = path.join(evidenceDir, "WEB-AI-001-login-semantic.png");
  const consoleLogPath = path.join(evidenceDir, "WEB-AI-001-console-errors.log");
  const pageErrorPath = path.join(evidenceDir, "WEB-AI-001-page-errors.log");

  try {
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Log in|Login|登录)$/i })).toBeVisible();

    const agent = new PlaywrightAgent(page);
    await agent.aiAssert(
      "This is a visible login page that clearly offers at least one usable sign-in method, such as phone, email, or WeChat login."
    );

    expect(pageErrors, `Page errors written to ${pageErrorPath}`).toEqual([]);
    status = consoleErrors.length ? "passed_with_console_errors" : "passed";
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    await writeFile(consoleLogPath, consoleErrors.join("\n"), "utf8");
    await writeFile(pageErrorPath, pageErrors.join("\n"), "utf8");
    await writeFile(
      path.join(reportDir, "ai-summary.md"),
      [
        "# Web QA AI Summary",
        "",
        `- Run ID: ${runId}`,
        "- Scenario: WEB-AI-001 public login page communicates a usable login path",
        `- Status: ${status}`,
        `- Browser: ${testInfo.project.name}`,
        `- URL: ${page.url()}`,
        `- Screenshot: ${screenshotPath}`,
        "- Midscene report directory: midscene_run/report",
        `- Console errors: ${consoleErrors.length}`,
        `- Page errors: ${pageErrors.length}`,
        ...(failure ? [`- Failure: ${failure.replace(/\n/g, " ")}`] : []),
        ""
      ].join("\n"),
      "utf8"
    );
  }
});
