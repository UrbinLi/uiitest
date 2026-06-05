import type {
  AiAssertion,
  CleanupPolicy,
  HardAssertion,
  HardAssertionType,
  Priority,
  SafetyLevel,
  StandardCase,
  StandardCaseStep,
  StepType,
} from "./types.js";

const PRIORITIES = new Set<Priority>(["P0", "P1", "P2", "P3"]);
const SAFETY_LEVELS = new Set<SafetyLevel>([
  "readonly",
  "controlled-write",
  "dangerous-write",
]);
const CLEANUP_POLICIES = new Set<CleanupPolicy>(["none", "best-effort", "required"]);
const STEP_TYPES = new Set<StepType>([
  "goto",
  "click",
  "fill",
  "wait_for",
  "ai_act",
  "ai_query",
  "api_check",
  "manual_note",
]);
const HARD_ASSERTION_TYPES = new Set<HardAssertionType>([
  "url_contains",
  "text_visible",
  "locator_visible",
  "locator_count",
]);

type CaseValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] };

type UnknownRecord = Record<string, unknown>;

export function validateCaseRecord(raw: unknown): CaseValidationResult {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { valid: false, errors: ["case record must be an object"] };
  }

  validateRequiredString(raw, "case_id", "caseId", errors);
  validateRequiredString(raw, "module", "module", errors);
  validateRequiredString(raw, "feature", "feature", errors);
  validateRequiredString(raw, "title", "title", errors);
  validateRequiredString(raw, "data_profile", "dataProfile", errors);
  validateRequiredString(raw, "owner", "owner", errors);
  validateEnum(raw, "priority", "priority", PRIORITIES, errors);
  validateBoolean(raw, "enabled", "enabled", errors);
  validateEnum(raw, "safety_level", "safetyLevel", SAFETY_LEVELS, errors);
  validateEnum(raw, "cleanup_policy", "cleanupPolicy", CLEANUP_POLICIES, errors);
  validateStringArray(raw, "env_scope", "envScope", errors);
  validateStringArray(raw, "tags", "tags", errors);
  validateStringArray(raw, "preconditions", "preconditions", errors);
  validateCaseAssertions(raw, errors);
  validateSteps(raw, errors);

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function normalizeCaseRecord(raw: unknown): StandardCase {
  const validation = validateCaseRecord(raw);

  if (!validation.valid) {
    throw new Error(`Invalid case record: ${validation.errors.join("; ")}`);
  }

  const record = raw as UnknownRecord;
  const standardCase: StandardCase = {
    caseId: getString(record, "case_id", "caseId"),
    module: getString(record, "module", "module"),
    feature: getString(record, "feature", "feature"),
    title: getString(record, "title", "title"),
    priority: getValue(record, "priority", "priority") as Priority,
    enabled: getValue(record, "enabled", "enabled") as boolean,
    safetyLevel: getValue(record, "safety_level", "safetyLevel") as SafetyLevel,
    cleanupPolicy: getValue(record, "cleanup_policy", "cleanupPolicy") as CleanupPolicy,
    envScope: getStringArray(record, "env_scope", "envScope"),
    tags: getStringArray(record, "tags", "tags"),
    dataProfile: getString(record, "data_profile", "dataProfile"),
    owner: getString(record, "owner", "owner"),
    preconditions: getStringArray(record, "preconditions", "preconditions"),
    hardAssertions: getHardAssertions(record).map(normalizeHardAssertion),
    aiAssertions: getAiAssertions(record).map(normalizeAiAssertion),
    steps: getSteps(record).map(normalizeStep),
  };

  const feishuRecordId = getOptionalString(record, "feishu_record_id", "feishuRecordId");
  if (feishuRecordId !== undefined) {
    standardCase.feishuRecordId = feishuRecordId;
  }

  return standardCase;
}

function validateSteps(record: UnknownRecord, errors: string[]): void {
  const steps = getValue(record, "steps", "steps");

  if (!Array.isArray(steps)) {
    errors.push("steps must be an array");
    return;
  }

  if (steps.length === 0) {
    errors.push("steps must contain at least one step");
    return;
  }

  steps.forEach((step, index) => {
    if (!isRecord(step)) {
      errors.push(`steps[${index}] must be an object`);
      return;
    }

    const stepType = getValue(step, "type", "type");
    if (typeof stepType !== "string" || !STEP_TYPES.has(stepType as StepType)) {
      errors.push(`steps[${index}].type must be one of ${Array.from(STEP_TYPES).join(", ")}`);
    }
  });
}

function validateCaseAssertions(record: UnknownRecord, errors: string[]): void {
  const hardAssertions = getValue(record, "hard_assertions", "hardAssertions");
  if (!Array.isArray(hardAssertions)) {
    errors.push("hard_assertions must be an array");
  } else {
    hardAssertions.forEach((assertion, assertionIndex) => {
      validateHardAssertion(assertion, assertionIndex, errors);
    });
  }

  const aiAssertions = getValue(record, "ai_assertions", "aiAssertions");
  if (!Array.isArray(aiAssertions)) {
    errors.push("ai_assertions must be an array");
  } else {
    aiAssertions.forEach((assertion, assertionIndex) => {
      validateAiAssertion(assertion, assertionIndex, errors);
    });
  }
}

function validateHardAssertion(
  assertion: unknown,
  assertionIndex: number,
  errors: string[],
): void {
  const path = `hard_assertions[${assertionIndex}]`;

  if (!isRecord(assertion)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const assertionType = getValue(assertion, "type", "type");
  if (
    typeof assertionType !== "string" ||
    !HARD_ASSERTION_TYPES.has(assertionType as HardAssertionType)
  ) {
    errors.push(`${path}.type must be one of ${Array.from(HARD_ASSERTION_TYPES).join(", ")}`);
  } else {
    switch (assertionType) {
      case "url_contains":
      case "text_visible":
        validateNonEmptyStringProperty(assertion, "expected", path, errors);
        break;
      case "locator_visible":
        validateNonEmptyStringProperty(assertion, "target", path, errors);
        break;
      case "locator_count":
        validateNonEmptyStringProperty(assertion, "target", path, errors);
        validateNumberProperty(assertion, "expected", path, errors);
        break;
    }
  }

  validateOptionalRequired(assertion, path, errors);
}

function validateAiAssertion(
  assertion: unknown,
  assertionIndex: number,
  errors: string[],
): void {
  const path = `ai_assertions[${assertionIndex}]`;

  if (!isRecord(assertion)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const prompt = getValue(assertion, "prompt", "prompt");
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    errors.push(`${path}.prompt must be a non-empty string`);
  }

  validateOptionalRequired(assertion, path, errors);
}

function normalizeStep(step: unknown): StandardCaseStep {
  const record = step as UnknownRecord;
  const standardStep: StandardCaseStep = {
    type: getValue(record, "type", "type") as StepType,
  };

  const stepId = getOptionalString(record, "step_id", "stepId");
  if (stepId !== undefined) {
    standardStep.stepId = stepId;
  }

  copyOptionalString(record, standardStep, "description", "description", "description");
  copyOptionalString(record, standardStep, "target", "target", "target");
  copyOptionalString(record, standardStep, "input", "input", "input");
  copyOptionalString(record, standardStep, "value", "value", "value");
  copyOptionalString(record, standardStep, "note", "note", "note");

  const timeoutMs = getOptionalValue(record, "timeout_ms", "timeoutMs");
  if (typeof timeoutMs === "number") {
    standardStep.timeoutMs = timeoutMs;
  }

  const metadata = getOptionalValue(record, "metadata", "metadata");
  if (isRecord(metadata)) {
    standardStep.metadata = { ...metadata };
  }

  return standardStep;
}

function normalizeHardAssertion(assertion: unknown): HardAssertion {
  const record = assertion as UnknownRecord;
  const type = getValue(record, "type", "type") as HardAssertionType;
  const required = getValue(record, "required", "required") === false ? false : true;

  switch (type) {
    case "url_contains":
    case "text_visible":
      return {
        type,
        expected: getString(record, "expected", "expected"),
        required,
      };
    case "locator_visible":
      return {
        type,
        target: getString(record, "target", "target"),
        required,
      };
    case "locator_count":
      return {
        type,
        target: getString(record, "target", "target"),
        expected: getValue(record, "expected", "expected") as number,
        required,
      };
  }

  throw new Error(`Invalid hard assertion type: ${String(type)}`);
}

function normalizeAiAssertion(assertion: unknown): AiAssertion {
  const record = assertion as UnknownRecord;
  const standardAssertion: AiAssertion = {
    prompt: getString(record, "prompt", "prompt"),
    required: getValue(record, "required", "required") === false ? false : true,
  };

  return standardAssertion;
}

function validateRequiredString(
  record: UnknownRecord,
  snakeKey: string,
  camelKey: string,
  errors: string[],
): void {
  const value = getValue(record, snakeKey, camelKey);
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${snakeKey} must be a non-empty string`);
  }
}

function validateBoolean(
  record: UnknownRecord,
  snakeKey: string,
  camelKey: string,
  errors: string[],
): void {
  if (typeof getValue(record, snakeKey, camelKey) !== "boolean") {
    errors.push(`${snakeKey} must be a boolean`);
  }
}

function validateEnum<T extends string>(
  record: UnknownRecord,
  snakeKey: string,
  camelKey: string,
  allowed: Set<T>,
  errors: string[],
): void {
  const value = getValue(record, snakeKey, camelKey);
  if (typeof value !== "string" || !allowed.has(value as T)) {
    errors.push(`${snakeKey} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

function validateStringArray(
  record: UnknownRecord,
  snakeKey: string,
  camelKey: string,
  errors: string[],
): void {
  const value = getValue(record, snakeKey, camelKey);
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${snakeKey} must be an array of strings`);
  }
}

function validateNonEmptyStringProperty(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = getValue(record, key, key);
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path}.${key} must be a non-empty string`);
  }
}

function validateNumberProperty(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = getValue(record, key, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path}.${key} must be a number`);
  }
}

function validateOptionalRequired(record: UnknownRecord, path: string, errors: string[]): void {
  const required = getOptionalValue(record, "required", "required");
  if (required !== undefined && typeof required !== "boolean") {
    errors.push(`${path}.required must be a boolean`);
  }
}

function getSteps(record: UnknownRecord): unknown[] {
  return getValue(record, "steps", "steps") as unknown[];
}

function getHardAssertions(record: UnknownRecord): unknown[] {
  return getValue(record, "hard_assertions", "hardAssertions") as unknown[];
}

function getAiAssertions(record: UnknownRecord): unknown[] {
  return getValue(record, "ai_assertions", "aiAssertions") as unknown[];
}

function getString(record: UnknownRecord, snakeKey: string, camelKey: string): string {
  return getValue(record, snakeKey, camelKey) as string;
}

function getStringArray(record: UnknownRecord, snakeKey: string, camelKey: string): string[] {
  return [...(getValue(record, snakeKey, camelKey) as string[])];
}

function getOptionalString(
  record: UnknownRecord,
  snakeKey: string,
  camelKey: string,
): string | undefined {
  const value = getOptionalValue(record, snakeKey, camelKey);
  return typeof value === "string" ? value : undefined;
}

function copyOptionalString(
  source: UnknownRecord,
  target: object,
  snakeKey: string,
  camelKey: string,
  targetKey: string,
): void {
  const value = getOptionalString(source, snakeKey, camelKey);
  if (value !== undefined) {
    (target as Record<string, unknown>)[targetKey] = value;
  }
}

function getValue(record: UnknownRecord, snakeKey: string, camelKey: string): unknown {
  return snakeKey in record ? record[snakeKey] : record[camelKey];
}

function getOptionalValue(record: UnknownRecord, snakeKey: string, camelKey: string): unknown {
  return snakeKey in record || camelKey in record ? getValue(record, snakeKey, camelKey) : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
