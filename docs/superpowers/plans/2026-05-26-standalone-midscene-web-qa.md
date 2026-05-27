# Standalone Midscene Web QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an independent Playwright and Midscene.js QA repository that validates an AllyMatic web target URL and stores auditable evidence.

**Architecture:** The repository owns no application source code and receives its target via `QA_BASE_URL`. Native Playwright smoke checks enforce deterministic browser-health requirements; separate Midscene scenarios provide opt-in semantic validation and HTML evidence reports.

**Tech Stack:** Node.js, pnpm, TypeScript, Playwright, Midscene.js `@midscene/web`, GitHub Actions, Codex app-server model configuration.

---

### Task 1: Initialize The Standalone Test Repository

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.midscene.example`
- Create: `README.md`

- [x] **Step 1: Define package commands and pinned dependencies**

Create scripts for `qa:smoke`, `qa:ai`, and `qa:ai:codex`, then install `@playwright/test@1.60.0` and `@midscene/web@1.8.4` through `pnpm`.

- [x] **Step 2: Define generated-file boundaries**

Ignore `node_modules`, Playwright output, Midscene reports, and per-run evidence files while tracking evidence directory placeholders.

- [x] **Step 3: Document local operation**

Document starting the target app separately and running tests by supplying `QA_BASE_URL`.

### Task 2: Add Deterministic Smoke Evidence

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke/login.spec.ts`
- Create: `qa/scenarios/smoke/login.yaml`
- Create: `qa/run-web-qa.sh`
- Create: `qa/evidence/.gitkeep`
- Create: `qa/reports/.gitkeep`

- [x] **Step 1: Add a failing smoke discovery test before dependencies**

Create the login test and runner, then run `pnpm qa:smoke`; before installation it must fail because Playwright is unavailable.

- [x] **Step 2: Install dependencies and browser**

Run:

```bash
pnpm install
pnpm exec playwright install chromium
```

- [x] **Step 3: Run the smoke check against a target**

Verify login rendering, capture screenshot/log evidence, and fail when the target emits console or page errors.

Observed on unmodified local `allymatic-fe` `main`: Run ID `20260526-231732` failed with two captured console errors (Ant Design deprecated `bordered` usage and PostHog initialized without a token), with screenshot and logs retained locally.

### Task 3: Add Midscene Semantic Evidence

**Files:**
- Create: `playwright.midscene.config.ts`
- Create: `e2e/ai/login-semantic.spec.ts`
- Create: `qa/scenarios/ai/login-semantic.yaml`

- [x] **Step 1: Add the Midscene scenario**

Use the documented `PlaywrightAgent` API to ask whether the public page clearly provides a usable login method.

- [x] **Step 2: Add AI report configuration**

Enable `@midscene/web/playwright-reporter`, retain output in `midscene_run/`, and use a model-call-friendly timeout.

- [x] **Step 3: Verify local Codex execution**

Run:

```bash
QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:ai:codex
```

Expected: one AI scenario completes and a screenshot, Markdown summary, and Midscene HTML report exist.

Observed: Run ID `20260526-231751` passed semantic validation with diagnostic status `passed_with_console_errors` and produced the required files.

### Task 4: Add CI And Codex Integration

**Files:**
- Create: `.github/workflows/web-qa-smoke.yml`
- Create: `.github/workflows/web-qa-ai.yml`
- Modify: `/Users/a1234/.codex/skills/web-qa-scenarios/SKILL.md`
- Modify: `/Users/a1234/.codex/skills/web-qa-scenarios/scripts/run_web_qa.sh`

- [x] **Step 1: Add CI artifact uploads**

Use workflow-dispatch target URLs and upload `qa/evidence`, `qa/reports`, Playwright output, and Midscene output for 30 days.

- [x] **Step 2: Point Codex Skill at the standalone repository**

Change the default repository from `allymatic-fe` to `/Users/a1234/midscene`.

### Task 5: Remove The Misplaced Local Implementation And Publish

**Files:**
- Source repository to restore: `/Users/a1234/allymatic/allymatic-fe`
- New repository to commit: `/Users/a1234/midscene`

- [x] **Step 1: Return the application checkout to `main`**

After verifying the standalone repository, switch `allymatic-fe` from the unpushed local automation branch back to `main` and remove only generated QA output created during the superseded local implementation.

- [x] **Step 2: Verify and commit this repository**

Run syntax checks, test discovery, Midscene validation, and inspect evidence before committing the standalone repository.

- [x] **Step 3: Prepare GitHub publishing**

After the user authenticates `gh` and identifies the target GitHub owner/repository, push the standalone repository and create a draft pull request or new private repository as appropriate.

Observed: Published `main` and `codex/standalone-midscene-web-qa` to `UrbinLi/uiitest` and opened draft PR `https://github.com/UrbinLi/uiitest/pull/1`.
