# UI Automation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-driven UI automation framework that reads standardized Feishu cases, executes immutable local snapshots with Playwright and Midscene.js, stores evidence, and writes execution results back to Feishu.

**Architecture:** The framework keeps business case definitions outside executable specs: Feishu or local JSON is normalized into `cases/snapshots/<run-id>/cases.json`, then a Playwright data-driven spec executes the snapshot. TypeScript framework modules own schema validation, selection, safety gates, data profiles, assertions, evidence, reports, Feishu mapping, and writeback.

**Tech Stack:** Node.js, pnpm, TypeScript `NodeNext`, Playwright, Midscene.js `@midscene/web`, Node built-in `fetch`, Node built-in `node:test` through `tsx --test`.

---

## Scope Boundary

This plan implements the first working framework slice that can be tested locally without real Feishu credentials, while keeping Feishu read/write interfaces ready for live tokens. It does not migrate the earlier 138 production cases automatically. Real module migration happens after this framework foundation is green.

## File Structure

| Path | Responsibility |
| --- | --- |
| `package.json` | Add unit-test, framework-run, and framework-list scripts. |
| `tsconfig.json` | Include `src/**/*.ts` and `tests/**/*.ts` in strict type checking. |
| `.gitignore` | Ignore generated snapshots while keeping snapshot directory root tracked. |
| `cases/examples/content-readonly.case.json` | Local runnable example case. |
| `cases/schemas/case.schema.json` | Human-readable JSON schema for standardized case files. |
| `cases/snapshots/.gitkeep` | Track snapshot directory root. |
| `src/cases/types.ts` | Shared case, snapshot, assertion, result, and run types. |
| `src/cases/schema.ts` | Runtime normalization and validation for case records. |
| `src/cases/snapshot.ts` | Snapshot read/write helpers and run ID creation. |
| `src/runner/filters.ts` | Module, tag, priority, case ID, environment, and safety filtering. |
| `src/safety/safety.ts` | Safety-level gate and skipped-case reason generation. |
| `src/data-profiles/types.ts` | Data profile interfaces and lifecycle result types. |
| `src/data-profiles/registry.ts` | Built-in profile registry and lookup logic. |
| `src/evidence/recorder.ts` | Per-case evidence directory, step logs, screenshots, console logs, and page errors. |
| `src/reporting/summary.ts` | JSON and Markdown run summary generation. |
| `src/feishu/mapper.ts` | Convert Feishu records into normalized framework cases and result writeback payloads. |
| `src/feishu/client.ts` | Minimal Feishu Bitable API client using `fetch`. |
| `src/feishu/sync.ts` | Fetch Feishu table records and create local snapshots. |
| `src/feishu/writeback.ts` | Push local result summaries back to Feishu result fields. |
| `src/assertions/hard.ts` | Deterministic assertion executor. |
| `src/assertions/ai.ts` | Midscene assertion adapter boundary. |
| `src/cli/args.ts` | Small CLI argument parser used by sync and writeback commands. |
| `src/cli/sync-cases.ts` | CLI that creates a snapshot from local JSON or Feishu. |
| `src/cli/writeback-results.ts` | CLI that writes `summary.json` results back to Feishu when enabled. |
| `playwright.framework.config.ts` | Playwright config for generated case execution. |
| `e2e/framework/case-runner.spec.ts` | Data-driven Playwright spec that executes the active snapshot. |
| `qa/run-framework-qa.sh` | Orchestrates sync, Playwright execution, report paths, and optional writeback. |
| `tests/**/*.test.ts` | Unit tests for schema, filters, safety, reporting, Feishu mapping, and assertion boundaries. |
| `README.md` | Document local framework run, Feishu env vars, safety flags, and evidence output. |

---

### Task 1: Add TypeScript Unit-Test Harness

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Add the test runner dependency**

Run:

```bash
pnpm add -D tsx
```

Expected: `package.json` and `pnpm-lock.yaml` include `tsx` as a dev dependency.

- [ ] **Step 2: Update package scripts**

Modify `package.json` scripts to include these entries while keeping existing scripts. Defer the framework runner script to Task 9, after `qa/run-framework-qa.sh` exists.

```json
{
  "scripts": {
    "qa:smoke": "bash qa/run-web-qa.sh smoke",
    "qa:ai": "bash qa/run-web-qa.sh ai",
    "qa:ai:codex": "bash qa/run-web-qa.sh ai-codex",
    "test:unit": "tsx --test tests/**/*.test.ts",
    "test:list": "playwright test --list",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Expand TypeScript coverage**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "@playwright/test"]
  },
  "include": ["e2e/**/*.ts", "src/**/*.ts", "tests/**/*.ts", "*.ts"]
}
```

- [ ] **Step 4: Verify current project still type-checks**

Run:

```bash
pnpm typecheck
```

Expected: command exits with code `0`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json
git commit -m "chore: add framework test harness"
```

---

### Task 2: Define Standard Case Types And Validation

**Files:**
- Create: `src/cases/types.ts`
- Create: `src/cases/schema.ts`
- Create: `cases/schemas/case.schema.json`
- Create: `cases/examples/content-readonly.case.json`
- Create: `tests/cases/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `tests/cases/schema.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCaseRecord, validateCaseRecord } from "../../src/cases/schema.js";

describe("case schema validation", () => {
  it("normalizes a valid readonly case", () => {
    const testCase = normalizeCaseRecord({
      case_id: "CONTENT-READ-001",
      module: "content-management",
      feature: "content-list",
      title: "EaseNest content can be filtered",
      priority: "P1",
      enabled: true,
      safety_level: "readonly",
      env_scope: ["test", "staging"],
      tags: ["EaseNest", "content"],
      data_profile: "readonly-shared",
      preconditions: ["User is already signed in"],
      steps: [
        { type: "goto", target: "/content/" },
        { type: "fill", target: "input[placeholder='Search']", value: "EaseNest" }
      ],
      hard_assertions: [
        { type: "url_contains", expected: "/content" },
        { type: "text_visible", expected: "EaseNest" }
      ],
      ai_assertions: [
        { prompt: "The content list is filtered to EaseNest-related items.", required: true }
      ],
      cleanup_policy: "none",
      owner: "qa"
    });

    assert.equal(testCase.caseId, "CONTENT-READ-001");
    assert.equal(testCase.safetyLevel, "readonly");
    assert.deepEqual(testCase.tags, ["EaseNest", "content"]);
  });

  it("rejects a case without executable steps", () => {
    const result = validateCaseRecord({
      case_id: "CONTENT-READ-002",
      module: "content-management",
      feature: "content-list",
      title: "Invalid case",
      priority: "P2",
      enabled: true,
      safety_level: "readonly",
      env_scope: ["test"],
      tags: [],
      data_profile: "readonly-shared",
      preconditions: [],
      steps: [],
      hard_assertions: [],
      ai_assertions: [],
      cleanup_policy: "none",
      owner: "qa"
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /steps must contain at least one step/);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm test:unit tests/cases/schema.test.ts
```

Expected: FAIL because `src/cases/schema.ts` does not exist.

- [ ] **Step 3: Create shared case types**

Create `src/cases/types.ts`:

```ts
export type Priority = "P0" | "P1" | "P2" | "P3";
export type SafetyLevel = "readonly" | "controlled-write" | "dangerous-write";
export type CleanupPolicy = "none" | "best-effort" | "required";
export type CaseStatus = "passed" | "failed" | "blocked" | "skipped" | "partial";
export type StepType = "goto" | "click" | "fill" | "wait_for" | "ai_act" | "ai_query" | "api_check" | "manual_note";

export type StandardCaseStep = {
  type: StepType;
  target?: string;
  value?: string;
  note?: string;
  timeoutMs?: number;
};

export type HardAssertion =
  | { type: "url_contains"; expected: string; required?: boolean }
  | { type: "text_visible"; expected: string; required?: boolean }
  | { type: "locator_visible"; target: string; required?: boolean }
  | { type: "locator_count"; target: string; expected: number; required?: boolean };

export type AiAssertion = {
  prompt: string;
  required: boolean;
};

export type StandardCase = {
  caseId: string;
  feishuRecordId?: string;
  module: string;
  feature: string;
  title: string;
  priority: Priority;
  enabled: boolean;
  safetyLevel: SafetyLevel;
  envScope: string[];
  tags: string[];
  dataProfile: string;
  preconditions: string[];
  steps: StandardCaseStep[];
  hardAssertions: HardAssertion[];
  aiAssertions: AiAssertion[];
  cleanupPolicy: CleanupPolicy;
  owner: string;
};

export type CaseSnapshot = {
  runId: string;
  createdAt: string;
  source: "local" | "feishu";
  sourceRef: string;
  filters: Record<string, string | string[] | boolean | undefined>;
  cases: StandardCase[];
};

export type CaseResult = {
  caseId: string;
  feishuRecordId?: string;
  module: string;
  title: string;
  status: CaseStatus;
  durationMs: number;
  failure?: string;
  evidenceDir: string;
  startedAt: string;
  finishedAt: string;
};
```

- [ ] **Step 4: Create runtime validator and normalizer**

Create `src/cases/schema.ts`:

```ts
import type { AiAssertion, CleanupPolicy, HardAssertion, Priority, SafetyLevel, StandardCase, StandardCaseStep } from "./types.js";

type ValidationResult = { valid: true; errors: [] } | { valid: false; errors: string[] };

const priorities = new Set<Priority>(["P0", "P1", "P2", "P3"]);
const safetyLevels = new Set<SafetyLevel>(["readonly", "controlled-write", "dangerous-write"]);
const cleanupPolicies = new Set<CleanupPolicy>(["none", "best-effort", "required"]);
const stepTypes = new Set(["goto", "click", "fill", "wait_for", "ai_act", "ai_query", "api_check", "manual_note"]);

function asStringArray(value: unknown, field: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    errors.push(`${field} must be an array of strings`);
    return [];
  }
  return value;
}

function asSteps(value: unknown, errors: string[]): StandardCaseStep[] {
  if (!Array.isArray(value)) {
    errors.push("steps must be an array");
    return [];
  }
  if (value.length === 0) {
    errors.push("steps must contain at least one step");
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`steps[${index}] must be an object`);
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.type !== "string" || !stepTypes.has(candidate.type)) {
      errors.push(`steps[${index}].type is invalid`);
      return [];
    }
    return [{
      type: candidate.type as StandardCaseStep["type"],
      target: typeof candidate.target === "string" ? candidate.target : undefined,
      value: typeof candidate.value === "string" ? candidate.value : undefined,
      note: typeof candidate.note === "string" ? candidate.note : undefined,
      timeoutMs: typeof candidate.timeoutMs === "number" ? candidate.timeoutMs : undefined
    }];
  });
}

function asHardAssertions(value: unknown, errors: string[]): HardAssertion[] {
  if (!Array.isArray(value)) {
    errors.push("hard_assertions must be an array");
    return [];
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`hard_assertions[${index}] must be an object`);
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.type !== "string") {
      errors.push(`hard_assertions[${index}].type is required`);
      return [];
    }
    if (candidate.type === "locator_count") {
      if (typeof candidate.target !== "string" || typeof candidate.expected !== "number") {
        errors.push(`hard_assertions[${index}] locator_count requires target and numeric expected`);
        return [];
      }
      return [{ type: "locator_count", target: candidate.target, expected: candidate.expected, required: candidate.required !== false }];
    }
    if (candidate.type === "locator_visible") {
      if (typeof candidate.target !== "string") {
        errors.push(`hard_assertions[${index}] locator_visible requires target`);
        return [];
      }
      return [{ type: "locator_visible", target: candidate.target, required: candidate.required !== false }];
    }
    if (candidate.type === "url_contains" || candidate.type === "text_visible") {
      if (typeof candidate.expected !== "string") {
        errors.push(`hard_assertions[${index}] ${candidate.type} requires expected`);
        return [];
      }
      return [{ type: candidate.type, expected: candidate.expected, required: candidate.required !== false }];
    }
    errors.push(`hard_assertions[${index}].type is invalid`);
    return [];
  });
}

function asAiAssertions(value: unknown, errors: string[]): AiAssertion[] {
  if (!Array.isArray(value)) {
    errors.push("ai_assertions must be an array");
    return [];
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`ai_assertions[${index}] must be an object`);
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.prompt !== "string" || candidate.prompt.trim().length === 0) {
      errors.push(`ai_assertions[${index}].prompt is required`);
      return [];
    }
    return [{ prompt: candidate.prompt, required: candidate.required !== false }];
  });
}

export function validateCaseRecord(raw: unknown): ValidationResult {
  const errors: string[] = [];
  try {
    normalizeCaseRecord(raw);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

export function normalizeCaseRecord(raw: unknown): StandardCase {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    throw new Error("case record must be an object");
  }
  const record = raw as Record<string, unknown>;
  const requiredStrings = ["case_id", "module", "feature", "title", "data_profile", "owner"];
  for (const field of requiredStrings) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (typeof record.priority !== "string" || !priorities.has(record.priority as Priority)) {
    errors.push("priority must be one of P0, P1, P2, P3");
  }
  if (typeof record.enabled !== "boolean") {
    errors.push("enabled must be boolean");
  }
  if (typeof record.safety_level !== "string" || !safetyLevels.has(record.safety_level as SafetyLevel)) {
    errors.push("safety_level must be readonly, controlled-write, or dangerous-write");
  }
  if (typeof record.cleanup_policy !== "string" || !cleanupPolicies.has(record.cleanup_policy as CleanupPolicy)) {
    errors.push("cleanup_policy must be none, best-effort, or required");
  }
  const envScope = asStringArray(record.env_scope, "env_scope", errors);
  const tags = asStringArray(record.tags, "tags", errors);
  const preconditions = asStringArray(record.preconditions, "preconditions", errors);
  const steps = asSteps(record.steps, errors);
  const hardAssertions = asHardAssertions(record.hard_assertions, errors);
  const aiAssertions = asAiAssertions(record.ai_assertions, errors);
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
  return {
    caseId: record.case_id as string,
    feishuRecordId: typeof record.feishu_record_id === "string" ? record.feishu_record_id : undefined,
    module: record.module as string,
    feature: record.feature as string,
    title: record.title as string,
    priority: record.priority as Priority,
    enabled: record.enabled as boolean,
    safetyLevel: record.safety_level as SafetyLevel,
    envScope,
    tags,
    dataProfile: record.data_profile as string,
    preconditions,
    steps,
    hardAssertions,
    aiAssertions,
    cleanupPolicy: record.cleanup_policy as CleanupPolicy,
    owner: record.owner as string
  };
}
```

- [ ] **Step 5: Add JSON schema documentation**

Create `cases/schemas/case.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UI Automation Standard Case",
  "type": "object",
  "required": [
    "case_id",
    "module",
    "feature",
    "title",
    "priority",
    "enabled",
    "safety_level",
    "env_scope",
    "tags",
    "data_profile",
    "preconditions",
    "steps",
    "hard_assertions",
    "ai_assertions",
    "cleanup_policy",
    "owner"
  ],
  "properties": {
    "case_id": { "type": "string" },
    "module": { "type": "string" },
    "feature": { "type": "string" },
    "title": { "type": "string" },
    "priority": { "enum": ["P0", "P1", "P2", "P3"] },
    "enabled": { "type": "boolean" },
    "safety_level": { "enum": ["readonly", "controlled-write", "dangerous-write"] },
    "env_scope": { "type": "array", "items": { "type": "string" } },
    "tags": { "type": "array", "items": { "type": "string" } },
    "data_profile": { "type": "string" },
    "preconditions": { "type": "array", "items": { "type": "string" } },
    "steps": { "type": "array", "minItems": 1 },
    "hard_assertions": { "type": "array" },
    "ai_assertions": { "type": "array" },
    "cleanup_policy": { "enum": ["none", "best-effort", "required"] },
    "owner": { "type": "string" }
  }
}
```

- [ ] **Step 6: Add one local example case**

Create `cases/examples/content-readonly.case.json`:

```json
[
  {
    "case_id": "CONTENT-READ-001",
    "module": "content-management",
    "feature": "content-list",
    "title": "EaseNest content can be filtered",
    "priority": "P1",
    "enabled": true,
    "safety_level": "readonly",
    "env_scope": ["local", "test", "staging"],
    "tags": ["EaseNest", "content"],
    "data_profile": "readonly-shared",
    "preconditions": ["User is signed in before the run starts"],
    "steps": [
      { "type": "goto", "target": "/content/" },
      { "type": "wait_for", "target": "body" },
      { "type": "manual_note", "note": "If the page requires manual login, reuse Playwright storage state outside committed files." }
    ],
    "hard_assertions": [
      { "type": "url_contains", "expected": "/content" }
    ],
    "ai_assertions": [
      { "prompt": "The visible page is the content management page or a clear authenticated-content landing page.", "required": true }
    ],
    "cleanup_policy": "none",
    "owner": "qa"
  }
]
```

- [ ] **Step 7: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 8: Commit**

```bash
git add src/cases tests/cases cases/schemas cases/examples
git commit -m "feat: define standard case schema"
```

---

### Task 3: Add Snapshot Creation And Case Filtering

**Files:**
- Create: `src/cases/snapshot.ts`
- Create: `src/runner/filters.ts`
- Create: `cases/snapshots/.gitkeep`
- Modify: `.gitignore`
- Create: `tests/cases/snapshot.test.ts`
- Create: `tests/runner/filters.test.ts`

- [ ] **Step 1: Write failing snapshot and filter tests**

Create `tests/cases/snapshot.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createRunId, writeSnapshot } from "../../src/cases/snapshot.js";
import type { StandardCase } from "../../src/cases/types.js";

const exampleCase: StandardCase = {
  caseId: "CONTENT-READ-001",
  module: "content-management",
  feature: "content-list",
  title: "EaseNest content can be filtered",
  priority: "P1",
  enabled: true,
  safetyLevel: "readonly",
  envScope: ["test"],
  tags: ["EaseNest"],
  dataProfile: "readonly-shared",
  preconditions: [],
  steps: [{ type: "goto", target: "/content/" }],
  hardAssertions: [],
  aiAssertions: [],
  cleanupPolicy: "none",
  owner: "qa"
};

describe("case snapshots", () => {
  it("writes immutable run input", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "qa-snapshot-"));
    try {
      const snapshotPath = await writeSnapshot({
        rootDir: root,
        runId: "20260604-120000",
        source: "local",
        sourceRef: "cases/examples/content-readonly.case.json",
        filters: { module: "content-management" },
        cases: [exampleCase]
      });
      const parsed = JSON.parse(await readFile(snapshotPath, "utf8"));
      assert.equal(parsed.runId, "20260604-120000");
      assert.equal(parsed.cases[0].caseId, "CONTENT-READ-001");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates filesystem-safe run ids", () => {
    assert.match(createRunId(new Date("2026-06-04T04:05:06Z")), /^20260604-040506$/);
  });
});
```

Create `tests/runner/filters.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectCases } from "../../src/runner/filters.js";
import type { StandardCase } from "../../src/cases/types.js";

const baseCase: StandardCase = {
  caseId: "CONTENT-READ-001",
  module: "content-management",
  feature: "content-list",
  title: "EaseNest content can be filtered",
  priority: "P1",
  enabled: true,
  safetyLevel: "readonly",
  envScope: ["test"],
  tags: ["EaseNest", "content"],
  dataProfile: "readonly-shared",
  preconditions: [],
  steps: [{ type: "goto", target: "/content/" }],
  hardAssertions: [],
  aiAssertions: [],
  cleanupPolicy: "none",
  owner: "qa"
};

describe("case filters", () => {
  it("selects enabled cases by module, tag, and environment", () => {
    const selected = selectCases([baseCase], {
      module: "content-management",
      tags: ["EaseNest"],
      env: "test"
    });
    assert.equal(selected.included.length, 1);
    assert.equal(selected.excluded.length, 0);
  });

  it("excludes disabled cases with a reason", () => {
    const selected = selectCases([{ ...baseCase, enabled: false }], { env: "test" });
    assert.equal(selected.included.length, 0);
    assert.equal(selected.excluded[0].reason, "disabled");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test:unit tests/cases/snapshot.test.ts tests/runner/filters.test.ts
```

Expected: FAIL because snapshot and filter modules do not exist.

- [ ] **Step 3: Implement snapshot helpers**

Create `src/cases/snapshot.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaseSnapshot, StandardCase } from "./types.js";

export function createRunId(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds())
  ].join("");
}

export async function writeSnapshot(input: {
  rootDir: string;
  runId: string;
  source: CaseSnapshot["source"];
  sourceRef: string;
  filters: CaseSnapshot["filters"];
  cases: StandardCase[];
}): Promise<string> {
  const snapshot: CaseSnapshot = {
    runId: input.runId,
    createdAt: new Date().toISOString(),
    source: input.source,
    sourceRef: input.sourceRef,
    filters: input.filters,
    cases: input.cases
  };
  const snapshotDir = path.join(input.rootDir, "cases", "snapshots", input.runId);
  await mkdir(snapshotDir, { recursive: true });
  const snapshotPath = path.join(snapshotDir, "cases.json");
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshotPath;
}

export async function readSnapshot(snapshotPath: string): Promise<CaseSnapshot> {
  return JSON.parse(await readFile(snapshotPath, "utf8")) as CaseSnapshot;
}
```

- [ ] **Step 4: Implement filtering**

Create `src/runner/filters.ts`:

```ts
import type { StandardCase } from "../cases/types.js";

export type CaseFilters = {
  module?: string;
  feature?: string;
  caseId?: string;
  tags?: string[];
  priority?: string;
  env?: string;
};

export type ExcludedCase = {
  testCase: StandardCase;
  reason: "disabled" | "module_mismatch" | "feature_mismatch" | "case_id_mismatch" | "tag_mismatch" | "priority_mismatch" | "env_mismatch";
};

export function selectCases(cases: StandardCase[], filters: CaseFilters): { included: StandardCase[]; excluded: ExcludedCase[] } {
  const included: StandardCase[] = [];
  const excluded: ExcludedCase[] = [];
  for (const testCase of cases) {
    const reason = exclusionReason(testCase, filters);
    if (reason) {
      excluded.push({ testCase, reason });
    } else {
      included.push(testCase);
    }
  }
  return { included, excluded };
}

function exclusionReason(testCase: StandardCase, filters: CaseFilters): ExcludedCase["reason"] | undefined {
  if (!testCase.enabled) return "disabled";
  if (filters.module && testCase.module !== filters.module) return "module_mismatch";
  if (filters.feature && testCase.feature !== filters.feature) return "feature_mismatch";
  if (filters.caseId && testCase.caseId !== filters.caseId) return "case_id_mismatch";
  if (filters.priority && testCase.priority !== filters.priority) return "priority_mismatch";
  if (filters.env && !testCase.envScope.includes(filters.env)) return "env_mismatch";
  if (filters.tags?.length) {
    const caseTags = new Set(testCase.tags);
    if (filters.tags.some((tag) => !caseTags.has(tag))) return "tag_mismatch";
  }
  return undefined;
}
```

- [ ] **Step 5: Ignore generated snapshots**

Modify `.gitignore`:

```gitignore
cases/snapshots/*
!cases/snapshots/.gitkeep
```

Create `cases/snapshots/.gitkeep`.

- [ ] **Step 6: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 7: Commit**

```bash
git add .gitignore src/cases/snapshot.ts src/runner/filters.ts tests/cases/snapshot.test.ts tests/runner/filters.test.ts cases/snapshots/.gitkeep
git commit -m "feat: add case snapshots and filters"
```

---

### Task 4: Add Safety Gates And Data Profiles

**Files:**
- Create: `src/safety/safety.ts`
- Create: `src/data-profiles/types.ts`
- Create: `src/data-profiles/registry.ts`
- Create: `tests/safety/safety.test.ts`
- Create: `tests/data-profiles/registry.test.ts`

- [ ] **Step 1: Write failing safety and profile tests**

Create `tests/safety/safety.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safetyDecision } from "../../src/safety/safety.js";

describe("safety gate", () => {
  it("allows readonly cases by default", () => {
    assert.deepEqual(safetyDecision("readonly", "readonly"), { allowed: true });
  });

  it("skips controlled writes when the run only allows readonly", () => {
    assert.deepEqual(safetyDecision("controlled-write", "readonly"), {
      allowed: false,
      reason: "safety_level_not_allowed"
    });
  });
});
```

Create `tests/data-profiles/registry.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDataProfile } from "../../src/data-profiles/registry.js";

describe("data profile registry", () => {
  it("returns the readonly shared profile", async () => {
    const profile = getDataProfile("readonly-shared");
    const setup = await profile.setup({ runId: "run-1", caseId: "case-1" });
    const cleanup = await profile.cleanup({ runId: "run-1", caseId: "case-1" });
    assert.equal(profile.name, "readonly-shared");
    assert.equal(setup.status, "passed");
    assert.equal(cleanup.status, "passed");
  });

  it("throws for unknown profiles", () => {
    assert.throws(() => getDataProfile("missing-profile"), /Unknown data profile/);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test:unit tests/safety/safety.test.ts tests/data-profiles/registry.test.ts
```

Expected: FAIL because safety and data-profile modules do not exist.

- [ ] **Step 3: Implement safety gate**

Create `src/safety/safety.ts`:

```ts
import type { SafetyLevel } from "../cases/types.js";

const rank: Record<SafetyLevel, number> = {
  readonly: 1,
  "controlled-write": 2,
  "dangerous-write": 3
};

export type SafetyDecision = { allowed: true } | { allowed: false; reason: "safety_level_not_allowed" };

export function safetyDecision(caseLevel: SafetyLevel, allowedLevel: SafetyLevel): SafetyDecision {
  return rank[caseLevel] <= rank[allowedLevel]
    ? { allowed: true }
    : { allowed: false, reason: "safety_level_not_allowed" };
}
```

- [ ] **Step 4: Implement data profile interfaces and registry**

Create `src/data-profiles/types.ts`:

```ts
export type DataProfileContext = {
  runId: string;
  caseId: string;
};

export type DataProfileLifecycleResult = {
  status: "passed" | "failed";
  notes: string[];
  createdMarkers: string[];
};

export type DataProfile = {
  name: string;
  safetyLevel: "readonly" | "controlled-write" | "dangerous-write";
  setup(context: DataProfileContext): Promise<DataProfileLifecycleResult>;
  cleanup(context: DataProfileContext): Promise<DataProfileLifecycleResult>;
};
```

Create `src/data-profiles/registry.ts`:

```ts
import type { DataProfile } from "./types.js";

const readonlyShared: DataProfile = {
  name: "readonly-shared",
  safetyLevel: "readonly",
  async setup() {
    return { status: "passed", notes: ["readonly profile requires no setup"], createdMarkers: [] };
  },
  async cleanup() {
    return { status: "passed", notes: ["readonly profile requires no cleanup"], createdMarkers: [] };
  }
};

const controlledWriteSmall: DataProfile = {
  name: "controlled-write-small",
  safetyLevel: "controlled-write",
  async setup(context) {
    return {
      status: "passed",
      notes: [`controlled write marker qa_${context.runId}_${context.caseId}`],
      createdMarkers: [`qa_${context.runId}_${context.caseId}`]
    };
  },
  async cleanup(context) {
    return {
      status: "passed",
      notes: [`cleanup completed for qa_${context.runId}_${context.caseId}`],
      createdMarkers: [`qa_${context.runId}_${context.caseId}`]
    };
  }
};

const profiles = new Map<string, DataProfile>([
  [readonlyShared.name, readonlyShared],
  [controlledWriteSmall.name, controlledWriteSmall]
]);

export function getDataProfile(name: string): DataProfile {
  const profile = profiles.get(name);
  if (!profile) {
    throw new Error(`Unknown data profile: ${name}`);
  }
  return profile;
}
```

- [ ] **Step 5: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 6: Commit**

```bash
git add src/safety src/data-profiles tests/safety tests/data-profiles
git commit -m "feat: add safety gates and data profiles"
```

---

### Task 5: Add Evidence Recorder And Run Summary Reporting

**Files:**
- Create: `src/evidence/recorder.ts`
- Create: `src/reporting/summary.ts`
- Create: `tests/evidence/recorder.test.ts`
- Create: `tests/reporting/summary.test.ts`

- [ ] **Step 1: Write failing evidence and report tests**

Create `tests/evidence/recorder.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createEvidenceRecorder } from "../../src/evidence/recorder.js";

describe("evidence recorder", () => {
  it("writes per-case step and diagnostic logs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "qa-evidence-"));
    try {
      const recorder = await createEvidenceRecorder({ evidenceRoot: root, caseId: "CONTENT-READ-001" });
      await recorder.step("open content page", "passed");
      await recorder.consoleError("TypeError: example");
      await recorder.pageError("Page crashed");
      await recorder.finish();
      const stepLog = await readFile(path.join(root, "CONTENT-READ-001", "steps.jsonl"), "utf8");
      const consoleLog = await readFile(path.join(root, "CONTENT-READ-001", "console-errors.log"), "utf8");
      assert.match(stepLog, /open content page/);
      assert.match(consoleLog, /TypeError/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

Create `tests/reporting/summary.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { writeRunSummary } from "../../src/reporting/summary.js";

describe("run summary", () => {
  it("writes JSON and Markdown with counts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "qa-report-"));
    try {
      await writeRunSummary({
        reportDir: root,
        runId: "run-1",
        startedAt: "2026-06-04T00:00:00.000Z",
        finishedAt: "2026-06-04T00:00:01.000Z",
        results: [
          {
            caseId: "CONTENT-READ-001",
            module: "content-management",
            title: "EaseNest content can be filtered",
            status: "passed",
            durationMs: 1000,
            evidenceDir: "qa/evidence/run-1/CONTENT-READ-001",
            startedAt: "2026-06-04T00:00:00.000Z",
            finishedAt: "2026-06-04T00:00:01.000Z"
          }
        ],
        writebackStatus: "disabled"
      });
      const json = JSON.parse(await readFile(path.join(root, "summary.json"), "utf8"));
      const markdown = await readFile(path.join(root, "summary.md"), "utf8");
      assert.equal(json.counts.passed, 1);
      assert.match(markdown, /CONTENT-READ-001/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test:unit tests/evidence/recorder.test.ts tests/reporting/summary.test.ts
```

Expected: FAIL because evidence and reporting modules do not exist.

- [ ] **Step 3: Implement evidence recorder**

Create `src/evidence/recorder.ts`:

```ts
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

export type StepStatus = "passed" | "failed" | "blocked" | "skipped";

export type EvidenceRecorder = {
  caseEvidenceDir: string;
  step(name: string, status: StepStatus, detail?: string): Promise<void>;
  consoleError(message: string): Promise<void>;
  pageError(message: string): Promise<void>;
  screenshot(page: Page, name: string): Promise<string>;
  finish(): Promise<void>;
};

export async function createEvidenceRecorder(input: { evidenceRoot: string; caseId: string }): Promise<EvidenceRecorder> {
  const caseEvidenceDir = path.join(input.evidenceRoot, input.caseId);
  await mkdir(caseEvidenceDir, { recursive: true });
  const stepsPath = path.join(caseEvidenceDir, "steps.jsonl");
  const consolePath = path.join(caseEvidenceDir, "console-errors.log");
  const pageErrorPath = path.join(caseEvidenceDir, "page-errors.log");
  await writeFile(stepsPath, "", "utf8");
  await writeFile(consolePath, "", "utf8");
  await writeFile(pageErrorPath, "", "utf8");
  return {
    caseEvidenceDir,
    async step(name, status, detail) {
      await appendFile(stepsPath, `${JSON.stringify({ at: new Date().toISOString(), name, status, detail })}\n`, "utf8");
    },
    async consoleError(message) {
      await appendFile(consolePath, `${message}\n`, "utf8");
    },
    async pageError(message) {
      await appendFile(pageErrorPath, `${message}\n`, "utf8");
    },
    async screenshot(page, name) {
      const screenshotPath = path.join(caseEvidenceDir, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return screenshotPath;
    },
    async finish() {
      await appendFile(stepsPath, `${JSON.stringify({ at: new Date().toISOString(), name: "finish evidence recording", status: "passed" })}\n`, "utf8");
    }
  };
}
```

- [ ] **Step 4: Implement summary writer**

Create `src/reporting/summary.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaseResult, CaseStatus } from "../cases/types.js";

export type WritebackStatus = "disabled" | "pending" | "passed" | "failed";

export type RunSummaryInput = {
  reportDir: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  results: CaseResult[];
  writebackStatus: WritebackStatus;
};

export async function writeRunSummary(input: RunSummaryInput): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(input.reportDir, { recursive: true });
  const counts = countStatuses(input.results);
  const summary = {
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    counts,
    writebackStatus: input.writebackStatus,
    results: input.results
  };
  const jsonPath = path.join(input.reportDir, "summary.json");
  const markdownPath = path.join(input.reportDir, "summary.md");
  await writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(markdownPath, renderMarkdown(summary), "utf8");
  return { jsonPath, markdownPath };
}

export async function updateWritebackStatus(reportDir: string, status: WritebackStatus): Promise<void> {
  const jsonPath = path.join(reportDir, "summary.json");
  const summary = JSON.parse(await readFile(jsonPath, "utf8")) as {
    runId: string;
    counts: Record<CaseStatus, number>;
    writebackStatus: WritebackStatus;
    results: CaseResult[];
  };
  summary.writebackStatus = status;
  await writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(markdownPathFor(reportDir), renderMarkdown(summary), "utf8");
}

function countStatuses(results: CaseResult[]): Record<CaseStatus, number> {
  return results.reduce<Record<CaseStatus, number>>(
    (counts, result) => {
      counts[result.status] += 1;
      return counts;
    },
    { passed: 0, failed: 0, blocked: 0, skipped: 0, partial: 0 }
  );
}

function markdownPathFor(reportDir: string): string {
  return path.join(reportDir, "summary.md");
}

function renderMarkdown(summary: {
  runId: string;
  counts: Record<CaseStatus, number>;
  writebackStatus: string;
  results: CaseResult[];
}): string {
  const lines = [
    "# UI Automation Run Summary",
    "",
    `- Run ID: ${summary.runId}`,
    `- Passed: ${summary.counts.passed}`,
    `- Failed: ${summary.counts.failed}`,
    `- Blocked: ${summary.counts.blocked}`,
    `- Skipped: ${summary.counts.skipped}`,
    `- Partial: ${summary.counts.partial}`,
    `- Feishu writeback: ${summary.writebackStatus}`,
    "",
    "| Case ID | Module | Status | Evidence | Failure |",
    "| --- | --- | --- | --- | --- |",
    ...summary.results.map((result) =>
      `| ${result.caseId} | ${result.module} | ${result.status} | ${result.evidenceDir} | ${(result.failure || "").replace(/\|/g, "\\|")} |`
    ),
    ""
  ];
  return lines.join("\n");
}
```

- [ ] **Step 5: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 6: Commit**

```bash
git add src/evidence src/reporting tests/evidence tests/reporting
git commit -m "feat: add evidence and summary reporting"
```

---

### Task 6: Add Feishu Mapping, Sync, And Writeback Payloads

**Files:**
- Create: `src/feishu/mapper.ts`
- Create: `src/feishu/client.ts`
- Create: `src/feishu/sync.ts`
- Create: `src/feishu/writeback.ts`
- Create: `tests/feishu/mapper.test.ts`
- Create: `tests/feishu/writeback.test.ts`

- [ ] **Step 1: Write failing Feishu mapper tests**

Create `tests/feishu/mapper.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapFeishuRecordToCase } from "../../src/feishu/mapper.js";

describe("Feishu case mapper", () => {
  it("maps standard table fields into a normalized case", () => {
    const testCase = mapFeishuRecordToCase({
      record_id: "rec123",
      fields: {
        case_id: "CONTENT-READ-001",
        module: "content-management",
        feature: "content-list",
        title: "EaseNest content can be filtered",
        priority: "P1",
        enabled: true,
        safety_level: "readonly",
        env_scope: ["test"],
        tags: ["EaseNest"],
        data_profile: "readonly-shared",
        preconditions: ["Signed in"],
        steps: JSON.stringify([{ type: "goto", target: "/content/" }]),
        hard_assertions: JSON.stringify([{ type: "url_contains", expected: "/content" }]),
        ai_assertions: JSON.stringify([{ prompt: "Content page is visible", required: true }]),
        cleanup_policy: "none",
        owner: "qa"
      }
    });
    assert.equal(testCase.feishuRecordId, "rec123");
    assert.equal(testCase.caseId, "CONTENT-READ-001");
  });
});
```

Create `tests/feishu/writeback.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWritebackFields } from "../../src/feishu/writeback.js";

describe("Feishu writeback payload", () => {
  it("updates only execution result fields", () => {
    assert.deepEqual(
      buildWritebackFields({
        runId: "run-1",
        status: "failed",
        failure: "Expected EaseNest text to be visible",
        evidenceUrl: "qa/reports/run-1/summary.md",
        executedAt: "2026-06-04T00:00:00.000Z"
      }),
      {
        last_run_id: "run-1",
        last_status: "failed",
        last_failure: "Expected EaseNest text to be visible",
        last_evidence_url: "qa/reports/run-1/summary.md",
        last_executed_at: "2026-06-04T00:00:00.000Z"
      }
    );
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test:unit tests/feishu/mapper.test.ts tests/feishu/writeback.test.ts
```

Expected: FAIL because Feishu modules do not exist.

- [ ] **Step 3: Implement Feishu mapper**

Create `src/feishu/mapper.ts`:

```ts
import { normalizeCaseRecord } from "../cases/schema.js";
import type { StandardCase } from "../cases/types.js";

export type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
};

export function mapFeishuRecordToCase(record: FeishuRecord): StandardCase {
  return normalizeCaseRecord({
    ...record.fields,
    feishu_record_id: record.record_id,
    steps: parseStructuredField(record.fields.steps, "steps"),
    hard_assertions: parseStructuredField(record.fields.hard_assertions, "hard_assertions"),
    ai_assertions: parseStructuredField(record.fields.ai_assertions, "ai_assertions")
  });
}

function parseStructuredField(value: unknown, field: string): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`${field} must be valid JSON when stored as text`);
    }
  }
  throw new Error(`${field} must be an array or JSON string`);
}
```

- [ ] **Step 4: Implement minimal Feishu API client**

Create `src/feishu/client.ts`:

```ts
import type { FeishuRecord } from "./mapper.js";

export type FeishuClientConfig = {
  appToken: string;
  tableId: string;
  bearerToken: string;
  baseUrl?: string;
};

export type FeishuClient = {
  listRecords(viewId?: string): Promise<FeishuRecord[]>;
  updateRecord(recordId: string, fields: Record<string, unknown>): Promise<void>;
};

export function createFeishuClient(config: FeishuClientConfig): FeishuClient {
  const baseUrl = config.baseUrl || "https://open.feishu.cn/open-apis";
  const tablePath = `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`;
  return {
    async listRecords(viewId) {
      const url = new URL(`${baseUrl}${tablePath}`);
      if (viewId) url.searchParams.set("view_id", viewId);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${config.bearerToken}` }
      });
      if (!response.ok) {
        throw new Error(`Feishu listRecords failed: ${response.status} ${await response.text()}`);
      }
      const body = await response.json() as { data?: { items?: FeishuRecord[] } };
      return body.data?.items || [];
    },
    async updateRecord(recordId, fields) {
      const response = await fetch(`${baseUrl}${tablePath}/${recordId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
      });
      if (!response.ok) {
        throw new Error(`Feishu updateRecord failed: ${response.status} ${await response.text()}`);
      }
    }
  };
}
```

- [ ] **Step 5: Implement sync and writeback helpers**

Create `src/feishu/sync.ts`:

```ts
import type { StandardCase } from "../cases/types.js";
import type { FeishuClient } from "./client.js";
import { mapFeishuRecordToCase } from "./mapper.js";

export async function syncFeishuCases(client: FeishuClient, viewId?: string): Promise<StandardCase[]> {
  const records = await client.listRecords(viewId);
  return records.map(mapFeishuRecordToCase);
}
```

Create `src/feishu/writeback.ts`:

```ts
import type { CaseStatus } from "../cases/types.js";
import type { FeishuClient } from "./client.js";

export type WritebackInput = {
  runId: string;
  status: CaseStatus;
  failure?: string;
  evidenceUrl: string;
  executedAt: string;
};

export function buildWritebackFields(input: WritebackInput): Record<string, unknown> {
  return {
    last_run_id: input.runId,
    last_status: input.status,
    last_failure: input.failure || "",
    last_evidence_url: input.evidenceUrl,
    last_executed_at: input.executedAt
  };
}

export async function writeCaseResult(client: FeishuClient, recordId: string, input: WritebackInput): Promise<void> {
  await client.updateRecord(recordId, buildWritebackFields(input));
}
```

- [ ] **Step 6: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 7: Commit**

```bash
git add src/feishu tests/feishu
git commit -m "feat: add feishu sync and writeback adapters"
```

---

### Task 7: Add Deterministic And Midscene Assertion Boundaries

**Files:**
- Create: `src/assertions/hard.ts`
- Create: `src/assertions/ai.ts`
- Create: `tests/assertions/ai.test.ts`

- [ ] **Step 1: Write failing AI adapter test**

Create `tests/assertions/ai.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAiAssertions } from "../../src/assertions/ai.js";

describe("AI assertions", () => {
  it("calls the agent for required prompts", async () => {
    const prompts: string[] = [];
    await runAiAssertions(
      [{ prompt: "The content list is visible", required: true }],
      { aiAssert: async (prompt) => { prompts.push(prompt); } }
    );
    assert.deepEqual(prompts, ["The content list is visible"]);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm test:unit tests/assertions/ai.test.ts
```

Expected: FAIL because assertion modules do not exist.

- [ ] **Step 3: Implement hard assertion executor**

Create `src/assertions/hard.ts`:

```ts
import { expect, type Page } from "@playwright/test";
import type { HardAssertion } from "../cases/types.js";

export async function runHardAssertions(page: Page, assertions: HardAssertion[]): Promise<void> {
  for (const assertion of assertions) {
    if (assertion.type === "url_contains") {
      expect(page.url()).toContain(assertion.expected);
    }
    if (assertion.type === "text_visible") {
      await expect(page.getByText(assertion.expected, { exact: false })).toBeVisible();
    }
    if (assertion.type === "locator_visible") {
      await expect(page.locator(assertion.target)).toBeVisible();
    }
    if (assertion.type === "locator_count") {
      await expect(page.locator(assertion.target)).toHaveCount(assertion.expected);
    }
  }
}
```

- [ ] **Step 4: Implement AI assertion adapter**

Create `src/assertions/ai.ts`:

```ts
import type { AiAssertion } from "../cases/types.js";

export type AiAssertAgent = {
  aiAssert(prompt: string): Promise<void>;
};

export async function runAiAssertions(assertions: AiAssertion[], agent: AiAssertAgent): Promise<void> {
  for (const assertion of assertions) {
    if (assertion.required) {
      await agent.aiAssert(assertion.prompt);
    }
  }
}
```

- [ ] **Step 5: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 6: Commit**

```bash
git add src/assertions tests/assertions
git commit -m "feat: add assertion execution boundaries"
```

---

### Task 8: Add CLI Sync And Writeback Commands

**Files:**
- Create: `src/cli/args.ts`
- Create: `src/cli/sync-cases.ts`
- Create: `src/cli/writeback-results.ts`
- Create: `tests/cli/args.test.ts`

- [ ] **Step 1: Write failing CLI parser test**

Create `tests/cli/args.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs } from "../../src/cli/args.js";

describe("CLI args", () => {
  it("parses flag values and booleans", () => {
    assert.deepEqual(parseArgs(["--source", "local", "--allow-controlled-write", "--module", "content-management"]), {
      source: "local",
      allowControlledWrite: true,
      module: "content-management"
    });
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm test:unit tests/cli/args.test.ts
```

Expected: FAIL because CLI modules do not exist.

- [ ] **Step 3: Implement CLI args**

Create `src/cli/args.ts`:

```ts
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = toCamelCase(token.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
```

- [ ] **Step 4: Implement sync CLI**

Create `src/cli/sync-cases.ts`:

```ts
import { readFile } from "node:fs/promises";
import process from "node:process";
import { normalizeCaseRecord } from "../cases/schema.js";
import { createRunId, writeSnapshot } from "../cases/snapshot.js";
import { createFeishuClient } from "../feishu/client.js";
import { syncFeishuCases } from "../feishu/sync.js";
import { parseArgs } from "./args.js";

const args = parseArgs(process.argv.slice(2));
const rootDir = process.cwd();
const runId = String(args.runId || process.env.QA_RUN_ID || createRunId());
const source = String(args.source || "local");
const sourceRef = String(args.input || process.env.QA_CASE_SOURCE || "cases/examples/content-readonly.case.json");

const cases = source === "feishu"
  ? await syncFeishuCases(
      createFeishuClient({
        appToken: requireEnv("FEISHU_APP_TOKEN"),
        tableId: requireEnv("FEISHU_TABLE_ID"),
        bearerToken: requireEnv("FEISHU_BEARER_TOKEN")
      }),
      typeof args.viewId === "string" ? args.viewId : process.env.FEISHU_VIEW_ID
    )
  : (JSON.parse(await readFile(sourceRef, "utf8")) as unknown[]).map(normalizeCaseRecord);

const snapshotPath = await writeSnapshot({
  rootDir,
  runId,
  source: source === "feishu" ? "feishu" : "local",
  sourceRef,
  filters: args,
  cases
});

console.log(`QA_RUN_ID=${runId}`);
console.log(`QA_CASE_SNAPSHOT=${snapshotPath}`);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
```

- [ ] **Step 5: Implement writeback CLI**

Create `src/cli/writeback-results.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createFeishuClient } from "../feishu/client.js";
import { writeCaseResult } from "../feishu/writeback.js";
import { updateWritebackStatus } from "../reporting/summary.js";
import { parseArgs } from "./args.js";

const args = parseArgs(process.argv.slice(2));
if (process.env.QA_FEISHU_WRITEBACK !== "1") {
  console.log("Feishu writeback disabled");
  process.exit(0);
}

const summaryPath = String(args.summary || process.env.QA_SUMMARY_PATH || "");
if (!summaryPath) {
  throw new Error("summary path is required");
}

const summary = JSON.parse(await readFile(summaryPath, "utf8")) as {
  runId: string;
  results: Array<{
    caseId: string;
    feishuRecordId?: string;
    status: "passed" | "failed" | "blocked" | "skipped" | "partial";
    failure?: string;
    evidenceDir: string;
    finishedAt: string;
  }>;
};

const reportDir = path.dirname(summaryPath);

try {
  const client = createFeishuClient({
    appToken: requireEnv("FEISHU_APP_TOKEN"),
    tableId: requireEnv("FEISHU_TABLE_ID"),
    bearerToken: requireEnv("FEISHU_BEARER_TOKEN")
  });

  for (const result of summary.results) {
    if (!result.feishuRecordId) continue;
    await writeCaseResult(client, result.feishuRecordId, {
      runId: summary.runId,
      status: result.status,
      failure: result.failure,
      evidenceUrl: result.evidenceDir,
      executedAt: result.finishedAt
    });
  }
  await updateWritebackStatus(reportDir, "passed");
} catch (error) {
  await updateWritebackStatus(reportDir, "failed").catch(() => undefined);
  throw error;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
```

- [ ] **Step 6: Verify local snapshot CLI**

Run:

```bash
QA_RUN_ID=plan-check pnpm exec tsx src/cli/sync-cases.ts --source local --input cases/examples/content-readonly.case.json
```

Expected output contains:

```text
QA_RUN_ID=plan-check
QA_CASE_SNAPSHOT=
```

- [ ] **Step 7: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 8: Commit**

```bash
git add src/cli tests/cli
git commit -m "feat: add framework CLI commands"
```

---

### Task 9: Add Data-Driven Playwright Runner And Shell Orchestration

**Files:**
- Create: `playwright.framework.config.ts`
- Create: `e2e/framework/case-runner.spec.ts`
- Create: `qa/run-framework-qa.sh`
- Modify: `package.json`

- [ ] **Step 1: Create framework Playwright config**

Create `playwright.framework.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.QA_BASE_URL;

if (!baseURL) {
  throw new Error("QA_BASE_URL is required. Point it at a local, test, or staging web application.");
}

export default defineConfig({
  testDir: "./e2e/framework",
  timeout: 180_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [
    ["list"],
    ["@midscene/web/playwright-reporter", { type: "merged" }],
    ["html", { outputFolder: "playwright-report/framework", open: "never" }]
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
```

- [ ] **Step 2: Create data-driven Playwright spec**

Create `e2e/framework/case-runner.spec.ts`:

```ts
import { test } from "@playwright/test";
import { PlaywrightAgent } from "@midscene/web/playwright";
import { readSnapshot } from "../../src/cases/snapshot.js";
import type { CaseResult, StandardCase } from "../../src/cases/types.js";
import { runAiAssertions } from "../../src/assertions/ai.js";
import { runHardAssertions } from "../../src/assertions/hard.js";
import { getDataProfile } from "../../src/data-profiles/registry.js";
import { createEvidenceRecorder } from "../../src/evidence/recorder.js";
import { writeRunSummary } from "../../src/reporting/summary.js";
import { selectCases } from "../../src/runner/filters.js";
import { safetyDecision } from "../../src/safety/safety.js";

const snapshotPath = process.env.QA_CASE_SNAPSHOT;
const evidenceRoot = process.env.QA_EVIDENCE_DIR || "qa/evidence/local";
const reportDir = process.env.QA_REPORT_DIR || "qa/reports/local";
const allowedSafety = process.env.QA_ALLOWED_SAFETY === "dangerous-write"
  ? "dangerous-write"
  : process.env.QA_ALLOWED_SAFETY === "controlled-write"
    ? "controlled-write"
    : "readonly";

if (!snapshotPath) {
  throw new Error("QA_CASE_SNAPSHOT is required");
}

const snapshot = await readSnapshot(snapshotPath);
const selected = selectCases(snapshot.cases, {
  module: process.env.QA_MODULE,
  feature: process.env.QA_FEATURE,
  caseId: process.env.QA_CASE_ID,
  tags: process.env.QA_TAGS ? process.env.QA_TAGS.split(",").filter(Boolean) : undefined,
  priority: process.env.QA_PRIORITY,
  env: process.env.QA_ENV
});

const runResults: CaseResult[] = [];

test.afterAll(async () => {
  await writeRunSummary({
    reportDir,
    runId: snapshot.runId,
    startedAt: snapshot.createdAt,
    finishedAt: new Date().toISOString(),
    results: runResults,
    writebackStatus: process.env.QA_FEISHU_WRITEBACK === "1" ? "pending" : "disabled"
  });
});

for (const excluded of selected.excluded) {
  test(`${excluded.testCase.caseId} skipped: ${excluded.reason}`, async () => {
    const now = new Date().toISOString();
    runResults.push({
      caseId: excluded.testCase.caseId,
      feishuRecordId: excluded.testCase.feishuRecordId,
      module: excluded.testCase.module,
      title: excluded.testCase.title,
      status: "skipped",
      durationMs: 0,
      failure: excluded.reason,
      evidenceDir: `${evidenceRoot}/${excluded.testCase.caseId}`,
      startedAt: now,
      finishedAt: now
    });
  });
}

for (const testCase of selected.included) {
  test(`${testCase.caseId} ${testCase.title}`, async ({ page }) => {
    const startedAt = new Date();
    const recorder = await createEvidenceRecorder({ evidenceRoot, caseId: testCase.caseId });
    page.on("console", (message) => {
      if (message.type() === "error") void recorder.consoleError(message.text());
    });
    page.on("pageerror", (error) => {
      void recorder.pageError(error.stack || error.message);
    });

    const safety = safetyDecision(testCase.safetyLevel, allowedSafety);
    if (!safety.allowed) {
      await recorder.step("safety gate", "skipped", safety.reason);
      await recorder.finish();
      recordResult(testCase, "skipped", startedAt, recorder.caseEvidenceDir, safety.reason);
      return;
    }

    const profile = getDataProfile(testCase.dataProfile);
    try {
      await recorder.step("data profile setup", "passed", JSON.stringify(await profile.setup({ runId: snapshot.runId, caseId: testCase.caseId })));
      for (const step of testCase.steps) {
        await recorder.step(`step ${step.type}`, "passed", JSON.stringify(step));
        const agent = new PlaywrightAgent(page);
        if (step.type === "goto" && step.target) {
          await page.goto(step.target, { waitUntil: "domcontentloaded" });
        } else if (step.type === "click" && step.target) {
          await page.locator(step.target).click();
        } else if (step.type === "fill" && step.target) {
          await page.locator(step.target).fill(step.value || "");
        } else if (step.type === "wait_for" && step.target) {
          await page.locator(step.target).waitFor({ timeout: step.timeoutMs });
        } else if (step.type === "ai_act" && step.note) {
          await agent.aiAct(step.note);
        } else if (step.type === "ai_query") {
          await agent.aiQuery(step.note || step.target || "Summarize the current visible page state.");
        } else if (step.type === "manual_note") {
          await recorder.step("manual note", "passed", step.note || "");
        } else if (step.type === "api_check") {
          throw new Error("api_check steps require a module-specific API helper and are not supported by the generic browser runner");
        } else {
          throw new Error(`Invalid step configuration for ${step.type}`);
        }
      }
      await runHardAssertions(page, testCase.hardAssertions);
      await runAiAssertions(testCase.aiAssertions, new PlaywrightAgent(page));
      await recorder.screenshot(page, "final");
      await recorder.step("assertions", "passed");
      await recorder.step("data profile cleanup", "passed", JSON.stringify(await profile.cleanup({ runId: snapshot.runId, caseId: testCase.caseId })));
      await recorder.finish();
      recordResult(testCase, "passed", startedAt, recorder.caseEvidenceDir);
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      await recorder.screenshot(page, "failure").catch(() => undefined);
      await recorder.step("case failed", "failed", failure);
      await recorder.finish();
      recordResult(testCase, "failed", startedAt, recorder.caseEvidenceDir, failure);
      throw error;
    }
  });
}

function recordResult(testCase: StandardCase, status: CaseResult["status"], startedAt: Date, evidenceDir: string, failure?: string): void {
  const finishedAt = new Date();
  runResults.push({
    caseId: testCase.caseId,
    feishuRecordId: testCase.feishuRecordId,
    module: testCase.module,
    title: testCase.title,
    status,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    failure,
    evidenceDir,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString()
  });
}
```

- [ ] **Step 3: Add shell orchestration**

Create `qa/run-framework-qa.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${QA_RUN_ID:-$(date +%Y%m%d-%H%M%S)}"

: "${QA_BASE_URL:?Set QA_BASE_URL to the target local, test, or staging URL.}"

export QA_RUN_ID="$RUN_ID"
export QA_EVIDENCE_DIR="${QA_EVIDENCE_DIR:-$ROOT_DIR/qa/evidence/$RUN_ID}"
export QA_REPORT_DIR="${QA_REPORT_DIR:-$ROOT_DIR/qa/reports/$RUN_ID}"
export QA_ALLOWED_SAFETY="${QA_ALLOWED_SAFETY:-readonly}"

mkdir -p "$QA_EVIDENCE_DIR" "$QA_REPORT_DIR"
cd "$ROOT_DIR"

SYNC_OUTPUT="$(pnpm exec tsx src/cli/sync-cases.ts --source "${QA_CASE_SOURCE_TYPE:-local}" --input "${QA_CASE_SOURCE:-cases/examples/content-readonly.case.json}" --run-id "$RUN_ID")"
echo "$SYNC_OUTPUT"
export QA_CASE_SNAPSHOT="$(printf '%s\n' "$SYNC_OUTPUT" | awk -F= '/^QA_CASE_SNAPSHOT=/{print $2}')"

echo "QA_RUN_ID=$QA_RUN_ID"
echo "QA_CASE_SNAPSHOT=$QA_CASE_SNAPSHOT"
echo "QA_EVIDENCE_DIR=$QA_EVIDENCE_DIR"
echo "QA_REPORT_DIR=$QA_REPORT_DIR"
echo "QA_ALLOWED_SAFETY=$QA_ALLOWED_SAFETY"

ARGS=("e2e/framework/case-runner.spec.ts")
if [ "${PLAYWRIGHT_HEADED:-0}" = "1" ]; then
  ARGS+=("--headed")
fi

pnpm exec playwright test --config playwright.framework.config.ts "${ARGS[@]}"
pnpm exec tsx src/cli/writeback-results.ts --summary "$QA_REPORT_DIR/summary.json"
```

Run:

```bash
chmod +x qa/run-framework-qa.sh
```

- [ ] **Step 4: Ensure package script exists**

Confirm `package.json` contains:

```json
"qa:framework": "bash qa/run-framework-qa.sh"
```

- [ ] **Step 5: Verify Playwright can discover the framework spec**

Run:

```bash
QA_BASE_URL="http://127.0.0.1:4174" QA_CASE_SNAPSHOT="cases/snapshots/plan-check/cases.json" pnpm exec playwright test --config playwright.framework.config.ts --list
```

Expected: if the snapshot path exists, output lists `CONTENT-READ-001`; if the target is not running, listing still succeeds because it does not navigate.

- [ ] **Step 6: Verify tests and types**

Run:

```bash
pnpm test:unit
pnpm typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 7: Commit**

```bash
git add playwright.framework.config.ts e2e/framework qa/run-framework-qa.sh package.json
git commit -m "feat: add data-driven framework runner"
```

---

### Task 10: Document Framework Operation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-04-ui-automation-framework-design.md`

- [ ] **Step 1: Add README framework section**

Append this section to `README.md`:

````markdown
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
````

- [ ] **Step 2: Mark implementation status in the spec**

Append this section to `docs/superpowers/specs/2026-06-04-ui-automation-framework-design.md`:

```markdown
## Implementation Status

The first implementation slice covers local and Feishu case ingestion interfaces, immutable snapshots, filters, safety gates, data profiles, Playwright execution, Midscene assertion boundaries, evidence collection, summaries, and Feishu result writeback payloads. Real business module migration is intentionally separate from the framework foundation.
```

- [ ] **Step 3: Run final verification**

Run:

```bash
pnpm test:unit
pnpm typecheck
QA_RUN_ID=verification pnpm exec tsx src/cli/sync-cases.ts --source local --input cases/examples/content-readonly.case.json
```

Expected:

```text
QA_RUN_ID=verification
QA_CASE_SNAPSHOT=
```

- [ ] **Step 4: Inspect generated directories**

Run:

```bash
git status --short
```

Expected: generated `cases/snapshots/verification/` is ignored; source files and docs only appear if they are not yet committed.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-06-04-ui-automation-framework-design.md
git commit -m "docs: document framework operation"
```

---

## Plan Self-Review

- Spec coverage: Feishu source and writeback are covered by Tasks 6 and 8; immutable local snapshots by Task 3; module and tag selection by Task 3; safety gates by Task 4; data profiles by Task 4; Playwright execution by Task 9; Midscene natural-language assertions by Task 7 and Task 9; evidence and reports by Task 5 and Task 9; docs by Task 10.
- Scope control: this plan builds the framework foundation and a runnable local example. It does not migrate existing production cases or execute authenticated production data.
- Verification: every code task starts with failing tests, then requires `pnpm test:unit` and `pnpm typecheck`. The runner task adds Playwright discovery verification.
- Risk note: live Feishu API behavior still needs one credentialed smoke run after implementation because unit tests only cover mapping and payload generation.
