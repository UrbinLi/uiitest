import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.QA_BASE_URL;

if (!baseURL) {
  throw new Error("QA_BASE_URL is required. Point it at a local, test, or staging web application.");
}

export default defineConfig({
  testDir: "./e2e/smoke",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/smoke", open: "never" }]
  ],
  use: {
    baseURL,
    headless: process.env.PLAYWRIGHT_HEADED !== "1",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
