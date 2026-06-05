import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { normalizeCaseRecord, validateCaseRecord } from "../../src/cases/schema.js";

const readonlyCase = {
  case_id: "CONTENT-READ-001",
  module: "content-management",
  feature: "EaseNest",
  title: "Readonly content page loads",
  priority: "P2",
  enabled: true,
  safety_level: "readonly",
  cleanup_policy: "none",
  env_scope: ["staging"],
  tags: ["content", "readonly"],
  data_profile: "seeded-content",
  owner: "qa",
  preconditions: ["User is signed in"],
  steps: [
    {
      step_id: "open-content",
      type: "goto",
      description: "Open the content page",
      target: "/content",
      hard_assertions: [
        {
          type: "url_contains",
          expected: "/content",
        },
      ],
      ai_assertions: [
        {
          prompt: "Confirm that the content page heading is visible.",
        },
      ],
    },
  ],
};

describe("case schema", () => {
  it("normalizes a valid snake_case readonly case into camelCase fields", () => {
    const normalized = normalizeCaseRecord(readonlyCase);

    assert.equal(normalized.caseId, "CONTENT-READ-001");
    assert.equal(normalized.safetyLevel, "readonly");
    assert.deepEqual(normalized.tags, ["content", "readonly"]);
    assert.equal(normalized.steps[0].stepId, "open-content");
    assert.equal(normalized.steps[0].hardAssertions?.[0].required, true);
    assert.equal(normalized.steps[0].aiAssertions?.[0].required, true);
  });

  it("rejects a case with empty steps", () => {
    const validation = validateCaseRecord({
      ...readonlyCase,
      steps: [],
    });

    assert.equal(validation.valid, false);
    assert.ok(validation.errors.includes("steps must contain at least one step"));
  });
});
