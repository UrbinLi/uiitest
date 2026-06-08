import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { mapFeishuRecordToCase } from "../../src/feishu/mapper.js";

const baseFields = {
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
  steps: JSON.stringify([
    {
      step_id: "open-content",
      type: "goto",
      description: "Open the content page",
      target: "/content",
    },
  ]),
  hard_assertions: JSON.stringify([
    {
      type: "url_contains",
      expected: "/content",
    },
  ]),
  ai_assertions: JSON.stringify([
    {
      prompt: "Confirm that the content page heading is visible.",
    },
  ]),
};

describe("Feishu case mapper", () => {
  it("maps a Feishu record into a normalized standard case", () => {
    const standardCase = mapFeishuRecordToCase({
      record_id: "rec123",
      fields: baseFields,
    });

    assert.equal(standardCase.feishuRecordId, "rec123");
    assert.equal(standardCase.caseId, "CONTENT-READ-001");
    assert.equal(standardCase.steps[0]?.stepId, "open-content");
    assert.deepEqual(standardCase.hardAssertions[0], {
      type: "url_contains",
      expected: "/content",
      required: true,
    });
    assert.deepEqual(standardCase.aiAssertions[0], {
      prompt: "Confirm that the content page heading is visible.",
      required: true,
    });
  });

  it("throws a field-specific error when steps text is invalid JSON", () => {
    assert.throws(
      () =>
        mapFeishuRecordToCase({
          record_id: "rec123",
          fields: {
            ...baseFields,
            steps: "{",
          },
        }),
      /steps must be valid JSON/,
    );
  });
});
