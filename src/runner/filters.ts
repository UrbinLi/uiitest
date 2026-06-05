import type { StandardCase } from "../cases/types.js";

export interface CaseFilters {
  module?: string;
  feature?: string;
  caseId?: string;
  tags?: string[];
  priority?: string;
  env?: string;
}

export type ExcludedCaseReason =
  | "disabled"
  | "module_mismatch"
  | "feature_mismatch"
  | "case_id_mismatch"
  | "tag_mismatch"
  | "priority_mismatch"
  | "env_mismatch";

export interface ExcludedCase {
  testCase: StandardCase;
  reason: ExcludedCaseReason;
}

export function selectCases(
  cases: StandardCase[],
  filters: CaseFilters,
): { included: StandardCase[]; excluded: ExcludedCase[] } {
  const included: StandardCase[] = [];
  const excluded: ExcludedCase[] = [];

  for (const testCase of cases) {
    const reason = getExclusionReason(testCase, filters);

    if (reason === undefined) {
      included.push(testCase);
    } else {
      excluded.push({ testCase, reason });
    }
  }

  return { included, excluded };
}

function getExclusionReason(
  testCase: StandardCase,
  filters: CaseFilters,
): ExcludedCaseReason | undefined {
  if (!testCase.enabled) {
    return "disabled";
  }

  if (filters.module !== undefined && testCase.module !== filters.module) {
    return "module_mismatch";
  }

  if (filters.feature !== undefined && testCase.feature !== filters.feature) {
    return "feature_mismatch";
  }

  if (filters.caseId !== undefined && testCase.caseId !== filters.caseId) {
    return "case_id_mismatch";
  }

  if (
    filters.tags !== undefined &&
    filters.tags.some((filterTag) => !testCase.tags.includes(filterTag))
  ) {
    return "tag_mismatch";
  }

  if (filters.priority !== undefined && testCase.priority !== filters.priority) {
    return "priority_mismatch";
  }

  if (filters.env !== undefined && !testCase.envScope.includes(filters.env)) {
    return "env_mismatch";
  }

  return undefined;
}
