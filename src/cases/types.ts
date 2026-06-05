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

export interface HardAssertion {
  type: HardAssertionType;
  required: boolean;
  expected?: string | number | boolean;
  locator?: string;
  note?: string;
}

export interface AiAssertion {
  prompt: string;
  required: boolean;
  note?: string;
}

export interface StandardCaseStep {
  stepId?: string;
  type: StepType;
  description?: string;
  target?: string;
  input?: string;
  timeoutMs?: number;
  hardAssertions?: HardAssertion[];
  aiAssertions?: AiAssertion[];
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
  steps: StandardCaseStep[];
  feishuRecordId?: string;
}

export interface CaseSnapshot {
  caseId: string;
  capturedAt: string;
  label: string;
  data: Record<string, unknown>;
}

export interface CaseResult {
  caseId: string;
  status: CaseStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  snapshots?: CaseSnapshot[];
  errors?: string[];
  feishuRecordId?: string;
}
