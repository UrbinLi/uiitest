import type { SafetyLevel } from "../cases/types.js";

const safetyRank: Record<SafetyLevel, number> = {
  readonly: 1,
  "controlled-write": 2,
  "dangerous-write": 3,
};

export type SafetyDecision =
  | { allowed: true }
  | { allowed: false; reason: "safety_level_not_allowed" };

export function safetyDecision(
  caseLevel: SafetyLevel,
  allowedLevel: SafetyLevel,
): SafetyDecision {
  if (safetyRank[caseLevel] <= safetyRank[allowedLevel]) {
    return { allowed: true };
  }

  return { allowed: false, reason: "safety_level_not_allowed" };
}
