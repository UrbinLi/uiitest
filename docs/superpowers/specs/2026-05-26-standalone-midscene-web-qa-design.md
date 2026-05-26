# Standalone Midscene Web QA Design

## Purpose

Build a standalone UI automation project at `/Users/a1234/midscene` for AllyMatic web validation. It stores scenarios, execution configuration, and evidence without modifying or embedding test files in the frontend application repository.

## Decision

The project treats the application as an external test target identified by `QA_BASE_URL`.

- Playwright smoke scenarios perform deterministic checks and fail on browser runtime errors.
- Midscene scenarios perform visual-semantic validation and retain browser diagnostics as evidence; the deterministic smoke layer remains responsible for the strict console-error quality gate.
- Local Midscene execution uses the signed-in Codex app-server session.
- GitHub Actions runs against a supplied test/staging URL and stores evidence artifacts for 30 days.

## Boundaries

| Concern | Owner |
| --- | --- |
| Business UI source code and application fixes | `allymatic-fe` or the relevant application repository |
| Test scenario contracts, runners, CI workflows, and evidence policy | `/Users/a1234/midscene` |
| Test execution target | URL supplied through `QA_BASE_URL` |
| Model credentials in CI | GitHub Actions Secrets |

The automation repository never contains production customer credentials or generated evidence from authenticated production pages.

## Components

| Path | Responsibility |
| --- | --- |
| `e2e/smoke/login.spec.ts` | Deterministic public login-page availability and browser-error check. |
| `e2e/ai/login-semantic.spec.ts` | Midscene semantic review of the public login experience. |
| `playwright.config.ts` | Base Playwright settings for a remote or separately running target. |
| `playwright.midscene.config.ts` | Midscene reporter and longer AI timeout. |
| `qa/scenarios/` | Versioned human-readable scenario definitions. |
| `qa/evidence/<run-id>/` | Screenshots and browser diagnostics. |
| `qa/reports/<run-id>/` | Markdown summaries for each execution. |
| `midscene_run/` | Generated Midscene HTML execution report. |
| `.github/workflows/` | Manual and scheduled execution against test URLs. |

## Local Execution

For a local target, the frontend application is started separately:

```bash
cd /Users/a1234/allymatic/allymatic-fe
pnpm dev --host 127.0.0.1 --port 4174
```

Tests run from the standalone repository:

```bash
cd /Users/a1234/midscene
QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:smoke
QA_BASE_URL="http://127.0.0.1:4174" pnpm qa:ai:codex
```

## Evidence And Result Semantics

- A smoke run passes only when the expected login UI renders and no console or page errors are observed.
- An AI run passes when the visual-semantic assertion succeeds and no unrecoverable page exception occurs. Console errors are recorded prominently in the AI summary so a semantic review cannot erase deterministic defects.
- Every execution stores a screenshot, console log, page-error log, and Markdown summary.
- Midscene execution additionally stores its HTML report under `midscene_run/report/`.

## Security Policy

Midscene may transmit visible page screenshots and visible UI text to the configured model. AI scenarios therefore run only against public pages or controlled test/staging data. CI credentials are configured through `MIDSCENE_MODEL_*` Secrets and are never committed.

