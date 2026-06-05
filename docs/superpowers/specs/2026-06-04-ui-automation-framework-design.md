# UI Automation Framework Design

## Purpose

Build a maintainable UI automation framework in `/Users/a1234/midscene` that uses Playwright for deterministic browser control and hard assertions, Midscene.js for visual-semantic UI understanding and natural-language assertions, and Feishu as the business test-case source.

The framework must support case data isolation, data-driven execution, module-level case selection, evidence-first reporting, and Feishu result writeback. It extends the existing standalone AllyMatic Web QA project instead of embedding tests in the frontend application repository.

## Confirmed Decisions

- Execution safety levels are explicit: `readonly`, `controlled-write`, and `dangerous-write`.
- Feishu is the source of business test cases.
- A local snapshot is the execution source for each run, so a run remains reproducible even if Feishu changes later.
- Feishu will use a new standard test-case table instead of adapting the current case table.
- Execution results are written back to Feishu, including status, failure reason, evidence link, and run ID.
- Test data isolation uses data profiles plus automatic cleanup.
- Assertions combine deterministic Playwright checks with Midscene natural-language assertions.
- The execution core is TypeScript plus Playwright plus the Midscene Playwright SDK. YAML or JSON is used for framework-owned case descriptions, not as the core Midscene runner.

## Midscene Basis

The design is based on the official Midscene Chinese README and the locally installed `@midscene/web` package.

The official README describes Midscene.js as AI-driven, visual-perception UI automation that supports JavaScript SDK and YAML authoring, Playwright integration, interaction APIs, extraction APIs, utility APIs such as `aiAssert`, `aiLocate`, and `aiWaitFor`, cache acceleration, and visual reports.

The local package exposes the Playwright SDK through `@midscene/web/playwright`. The installed types include `PlaywrightAgent`, `PlaywrightAiFixture`, and helpers such as `aiAct`, `aiInput`, `aiQuery`, `aiAssert`, `aiWaitFor`, `aiLocate`, `recordToReport`, `logScreenshot`, and cache strategies. That is enough to build a controlled TypeScript runner without making Midscene YAML the framework core.

## Non-Goals

- Do not run AI assertions against authenticated production customer data.
- Do not make Midscene the only assertion mechanism.
- Do not let Feishu table edits during a run change the active run definition.
- Do not automate `dangerous-write` cases unless the run explicitly enables them.
- Do not commit generated evidence, screenshots, reports, traces, or secrets.

## High-Level Architecture

```text
Feishu standard case table
  -> Feishu sync reads enabled cases
  -> Local snapshot stores immutable run input
  -> Runner filters by module, tag, safety level, environment, and data profile
  -> Data profile prepares isolated data
  -> Playwright executes deterministic navigation and hard assertions
  -> Midscene executes semantic observation, extraction, and natural-language assertions
  -> Evidence collector records screenshots, traces, console logs, network logs, step logs, and Midscene report links
  -> Reporter writes JSON, Markdown, and HTML summaries
  -> Feishu writer updates result fields and links the evidence package
  -> Cleanup executes profile-specific cleanup rules
```

## Proposed Directory Layout

```text
cases/
  snapshots/<run-id>/cases.json
  schemas/case.schema.json
  examples/
config/
  env/
  modules/
  model-profiles/
  feishu.ts
data-profiles/
  profiles/
  cleanup/
e2e/
  generated/
qa/
  evidence/<run-id>/
  reports/<run-id>/
  run-web-qa.sh
src/
  assertions/
  case-source/
  data-profiles/
  evidence/
  feishu/
  runner/
  reporting/
  safety/
```

The existing `e2e/smoke`, `e2e/ai`, `qa/evidence`, and `qa/reports` conventions remain valid. New framework modules should live under `src/` to keep business test definitions separate from framework code.

## Feishu Standard Case Table

The new Feishu table is the source that product, QA, and automation can share. It should contain these fields:

| Field | Purpose |
| --- | --- |
| `case_id` | Stable automation ID, for example `CONTENT-READ-001`. |
| `module` | Business module, for example `content-management` or `tiktok-shoppable-videos`. |
| `feature` | Feature area inside the module. |
| `title` | Human-readable case name. |
| `priority` | `P0`, `P1`, `P2`, or `P3`. |
| `enabled` | Whether the case can be synced and executed. |
| `safety_level` | `readonly`, `controlled-write`, or `dangerous-write`. |
| `env_scope` | Allowed environments, for example `local`, `test`, or `staging`. |
| `tags` | Free-form labels for selection and reporting. |
| `data_profile` | Named data profile used for setup and cleanup. |
| `preconditions` | Business preconditions in natural language. |
| `steps` | Ordered test steps. |
| `hard_assertions` | Deterministic checks such as URL, status code, count, text, or API state. |
| `ai_assertions` | Natural-language semantic checks for Midscene. |
| `cleanup_policy` | Cleanup behavior, such as `none`, `best-effort`, or `required`. |
| `owner` | Responsible QA or module owner. |
| `last_run_id` | Last framework run ID. |
| `last_status` | `passed`, `failed`, `blocked`, `skipped`, or `partial`. |
| `last_failure` | Short failure summary. |
| `last_evidence_url` | Link to report or evidence package. |
| `last_executed_at` | Execution timestamp. |

Long step and assertion fields should use JSON arrays or structured Feishu fields where possible. If Feishu stores them as rich text, the sync layer must normalize them into a strict local schema before execution.

## Local Case Snapshot

Each run creates an immutable snapshot:

```text
cases/snapshots/<run-id>/cases.json
```

The snapshot stores:

- Feishu record ID and table metadata.
- Normalized case fields.
- Run filters used to select the case.
- Data profile version.
- Framework version or git commit hash.
- Sync timestamp.

The runner reads only from the snapshot after sync. This makes results auditable because the executed input does not drift during a run.

## Data Profiles And Isolation

Each case references a named `data_profile`. A data profile defines:

- Required accounts and roles.
- Required seed data.
- Whether data is reused, created per run, or created per case.
- Allowed write scope.
- Cleanup strategy.
- Evidence fields needed to prove setup and cleanup.

Recommended profile types:

| Type | Use |
| --- | --- |
| `readonly-shared` | Stable read-only validation with no mutation. |
| `controlled-write-small` | Small mutation allowed, with cleanup by ID or marker. |
| `external-console-readonly` | Cross-system checks where the target system is read-only. |
| `external-console-controlled-write` | Cross-system checks with a small number of approved write operations. |

For controlled writes, generated records must include a run marker such as `qa_<run-id>_<case-id>` so cleanup can target only framework-created data.

## Execution Safety

Safety is enforced before execution:

- `readonly` cases can run by default.
- `controlled-write` cases require an explicit CLI flag or environment variable.
- `dangerous-write` cases require a separate explicit flag and should be disabled in regular CI.

If a case safety level exceeds the run allowance, the framework marks it `skipped` with reason `safety_level_not_allowed`. This is not a failure.

## Runner Behavior

The runner supports these filters:

- `module`
- `feature`
- `case_id`
- `tags`
- `priority`
- `safety_level`
- `env_scope`
- Feishu view ID at sync time

Execution order:

1. Create `run_id`.
2. Read run config and model profile.
3. Sync enabled Feishu cases into a local snapshot.
4. Validate snapshot against the local schema.
5. Select cases by filters and safety gate.
6. Prepare data profile.
7. Execute case steps.
8. Run hard assertions.
9. Run AI assertions.
10. Collect evidence.
11. Execute cleanup.
12. Generate reports.
13. Write result fields back to Feishu.

If Feishu writeback fails after local execution completes, the run remains valid locally and the report marks writeback as failed. Feishu writeback can be retried by `run_id`.

## Step Model

Each case step should be normalized to one of these operation types:

| Operation | Owner |
| --- | --- |
| `goto` | Playwright |
| `click` | Playwright first, Midscene fallback only when selector is intentionally semantic. |
| `fill` | Playwright first. |
| `wait_for` | Playwright or Midscene depending on target. |
| `ai_act` | Midscene for semantic UI actions. |
| `ai_query` | Midscene for extraction. |
| `api_check` | Framework helper or Playwright request context. |
| `manual_note` | Recorded as non-executable context. |

The framework should prefer deterministic selectors for stable product controls. Midscene actions are best for semantic navigation, visual verification, and places where DOM selectors are unstable or not meaningful.

## Assertion Model

Hard assertions are for facts:

- URL path or query.
- Element visible or hidden.
- Exact text when the wording is part of the contract.
- Counts, amounts, IDs, table rows, status values.
- API response fields.
- Cross-system record existence.

AI assertions are for semantics:

- The page communicates the intended state.
- The filtered content matches the business intent.
- Empty, loading, and error states are understandable.
- A card, video, content item, or listing visually corresponds to the expected business object.
- TikTok backend content is semantically consistent with AllyMatic content when exact DOM structure differs.

A case can pass only when required hard assertions pass and required AI assertions pass. Optional AI findings are recorded as warnings.

## Evidence Policy

Every executed case must produce an evidence package:

```text
qa/evidence/<run-id>/<case-id>/
```

Required evidence:

- Step log with timestamps.
- Final screenshot.
- Failure screenshot when status is failed.
- Browser console log.
- Page error log.
- Network summary for relevant requests.
- Data profile setup and cleanup log.
- Midscene report reference when AI APIs are used.

For cross-system validation, evidence must include screenshots or extracted structured data from each system being compared.

## Reporting

Each run writes:

```text
qa/reports/<run-id>/summary.json
qa/reports/<run-id>/summary.md
qa/reports/<run-id>/report.html
```

The report includes:

- Run config and filters.
- Total, passed, failed, blocked, skipped, and partial counts.
- Per-module result breakdown.
- Per-case result, duration, failure reason, and evidence path.
- Feishu writeback status.
- Cleanup status.
- AI model profile used.
- Known risk notes, including cases skipped by safety gate.

The Markdown summary is optimized for Feishu comments or release review. The JSON summary is optimized for automation and retries. The HTML report is optimized for manual triage.

## Feishu Writeback

The writeback layer updates only execution-result fields:

- `last_run_id`
- `last_status`
- `last_failure`
- `last_evidence_url`
- `last_executed_at`

It must not rewrite the business definition fields such as steps, assertions, module, or priority during result writeback. That separation prevents test execution from accidentally corrupting the case source.

For failed or blocked cases, `last_failure` should be concise and include the first actionable reason. Detailed logs stay in the evidence package.

## Model And Provider Configuration

Midscene model settings should remain environment-driven:

- `MIDSCENE_MODEL_API_KEY`
- `MIDSCENE_MODEL_BASE_URL`
- `MIDSCENE_MODEL_NAME`
- `MIDSCENE_MODEL_FAMILY`

Local Codex execution can continue to use the app-server profile already supported by the project. CI and staging runs use explicit model secrets. Reports must record the model profile name but not secrets.

## Error Handling

Error classification:

| Status | Meaning |
| --- | --- |
| `passed` | Required steps and assertions passed. |
| `failed` | Product behavior did not meet expected result. |
| `blocked` | Environment, login, data setup, or dependency issue prevented valid execution. |
| `skipped` | Case was intentionally not executed because of filters or safety policy. |
| `partial` | Some comparison or writeback completed, but the case did not reach full validation. |

Retries are allowed for infrastructure and AI transient errors, but not for deterministic assertion failures unless the case explicitly marks itself as flaky. Retry attempts must be visible in the report.

## Security Boundaries

- Secrets are read from environment variables or local ignored config files.
- Authenticated browser storage state is not committed.
- Evidence from authenticated environments is stored locally or in controlled artifact storage only.
- AI assertions must not be run against production customer pages unless the data is explicitly approved for model transmission.
- Feishu writeback tokens must be scoped to the standard case table and result fields where the platform permits field-level control.

## Testing Strategy For The Framework

Framework tests should cover:

- Case schema validation.
- Feishu record normalization.
- Snapshot immutability.
- Filter selection.
- Safety gating.
- Data profile setup and cleanup lifecycle.
- Hard assertion evaluation.
- AI assertion invocation boundaries with mock adapters.
- Report generation.
- Feishu writeback payload generation and retry behavior.

Initial end-to-end validation should use a small local fixture table or exported Feishu sample, then run one readonly case and one controlled-write case against a controlled test environment.

## Implementation Phases

### Phase 1: Skeleton And Case Schema

Create the case schema, snapshot format, CLI filters, and local runner using fixture cases only.

### Phase 2: Evidence And Reporting

Add per-case evidence folders, step logs, screenshots, console logs, network summaries, and JSON/Markdown/HTML reports.

### Phase 3: Feishu Sync And Writeback

Add Feishu read support, snapshot generation from the standard table, and writeback for result fields.

### Phase 4: Data Profiles And Safety Gates

Add named data profiles, setup and cleanup hooks, and strict safety gating for controlled writes and dangerous writes.

### Phase 5: Midscene Assertion Layer

Wrap the Midscene Playwright SDK for `aiAssert`, `aiQuery`, `aiWaitFor`, report recording, model profile logging, and AI retry classification.

### Phase 6: Module Rollout

Migrate real modules gradually. Start with one readonly module, then one controlled-write module, then cross-system content comparison such as AllyMatic content management versus TikTok shoppable videos.

## Acceptance Criteria

- A new Feishu standard table can be synced into a local immutable snapshot.
- Cases can be selected by module, tag, priority, safety level, and case ID.
- Readonly cases run by default.
- Controlled-write cases run only when explicitly enabled.
- Every executed case produces a complete evidence package.
- Reports include exact executed counts and skipped reasons.
- Feishu receives result writeback without modifying business case fields.
- A failed case includes enough evidence for development triage without asking QA for missing reproduction details.
- The framework can run without Feishu by using an existing local snapshot.

## Implementation Status

The first implementation slice covers local and Feishu case ingestion interfaces, immutable snapshots, filters, safety gates, data profiles, Playwright execution, Midscene assertion boundaries, evidence collection, summaries, and Feishu result writeback payloads. Real business module migration is intentionally separate from the framework foundation.
