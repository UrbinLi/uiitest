# AllyMatic Web QA

Standalone UI automation and evidence storage for an AllyMatic web target, using Playwright for deterministic checks and Midscene.js for visual-semantic validation.

## Run Locally

Start the application under test separately. For example:

```bash
cd /Users/a1234/allymatic/allymatic-fe
pnpm dev --host 127.0.0.1 --port 4174
```

In this repository, install dependencies and the browser once:

```bash
cd /Users/a1234/midscene
pnpm install
pnpm exec playwright install chromium
```

Run the deterministic public-login check:

```bash
QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:smoke
```

Run the Midscene semantic validation using the signed-in local Codex session:

```bash
QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:ai:codex
```

For test or staging deployments, replace `QA_BASE_URL` with the deployed URL.

The smoke scenario is intentionally strict: browser console or page errors fail the run. The AI scenario evaluates visible usability and records console diagnostics in its summary; a `passed_with_console_errors` result means the semantic check succeeded but the target still has quality findings to investigate.

## Data-Driven Framework

The framework runner reads standardized cases from a local JSON file or Feishu, writes an immutable snapshot under `cases/snapshots/<run-id>/cases.json`, executes selected cases through Playwright and Midscene, stores evidence under `qa/evidence/<run-id>/`, and writes reports under `qa/reports/<run-id>/`.

Run a local snapshot-backed case:

```bash
QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:framework
```

Useful filters:

```bash
QA_MODULE="content-management" QA_TAGS="EaseNest" QA_ENV="test" QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:framework
```

Controlled writes require an explicit safety level:

```bash
QA_ALLOWED_SAFETY="controlled-write" QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:framework
```

Feishu sync requires:

- `QA_CASE_SOURCE_TYPE=feishu`
- `FEISHU_APP_TOKEN`
- `FEISHU_TABLE_ID`
- `FEISHU_BEARER_TOKEN`
- optional `FEISHU_VIEW_ID`

Feishu result writeback runs only when `QA_FEISHU_WRITEBACK=1`.

## Evidence

Each run prints a timestamped run ID and writes:

- `qa/evidence/<run-id>/`: screenshots and browser diagnostic logs.
- `qa/reports/<run-id>/`: Markdown run summaries.
- `playwright-report/`: Playwright HTML result.
- `test-results/`: Playwright failure traces and recordings.
- `midscene_run/report/`: Midscene HTML report for AI scenarios.

Generated evidence is not committed. GitHub Actions uploads it as an artifact with a 30-day retention period.

## GitHub Actions

Both workflows are manually triggered and require a public or controlled test/staging `base_url` input:

- `Web QA Smoke` runs deterministic browser-health validation.
- `Web QA Midscene` runs semantic validation and requires these GitHub Secrets: `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_NAME`, and `MIDSCENE_MODEL_FAMILY`.

## Data Boundary

Midscene may send visible screenshots and visible UI text to its configured model. Run AI scenarios only against public pages or controlled test/staging data, never authenticated production customer pages.
