export type Priority = "P0" | "P1" | "P2" | "P3";

export type SafetyLevel = "readonly" | "controlled-write" | "dangerous-write";

export type CleanupPolicy = "none" | "best-effort" | "required";

export type CaseStatus = "passed" | "failed" | "blocked" | "skipped" | "partial";

export type StepType =
  | "goto"
  | "click"
  | "fill"
  | "wait_for"
  | "ai_act"
  | "ai_query"
  | "api_check"
  | "manual_note";

export type HardAssertionType =
  | "url_contains"
  | "text_visible"
  | "locator_visible"
  | "locator_count";

export type HardAssertion =
  | { type: "url_contains"; expected: string; required?: boolean }
  | { type: "text_visible"; expected: string; required?: boolean }
  | { type: "locator_visible"; target: string; required?: boolean }
  | { type: "locator_count"; target: string; expected: number; required?: boolean };

export interface AiAssertion {
  prompt: string;
  required: boolean;
}

export interface StandardCaseStep {
  stepId?: string;
  type: StepType;
  description?: string;
  target?: string;
  input?: string;
  value?: string;
  note?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface StandardCase {
  caseId: string;
  module: string;
  feature: string;
  title: string;
  priority: Priority;
  enabled: boolean;
  safetyLevel: SafetyLevel;
  cleanupPolicy: CleanupPolicy;
  envScope: string[];
  tags: string[];
  dataProfile: string;
  owner: string;
  preconditions: string[];
  hardAssertions: HardAssertion[];
  aiAssertions: AiAssertion[];
  steps: StandardCaseStep[];
  feishuRecordId?: string;
}

export interface CaseSnapshot {
  runId: string;
  createdAt: string;
  source: "local" | "feishu";
  sourceRef: string;
  filters: Record<string, unknown>;
  cases: StandardCase[];
}

export interface CaseResult {
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
}
