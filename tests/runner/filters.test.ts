import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { selectCases } from "../../src/runner/filters.js";
import type { StandardCase } from "../../src/cases/types.js";

function buildCase(overrides: Partial<StandardCase> = {}): StandardCase {
  return {
    caseId: "CONTENT-READ-001",
    module: "content-management",
    feature: "EaseNest",
    title: "Readonly content page loads",
    priority: "P2",
    enabled: true,
    safetyLevel: "readonly",
    cleanupPolicy: "none",
    envScope: ["staging"],
    tags: ["content", "readonly"],
    dataProfile: "seeded-content",
    owner: "qa",
    preconditions: ["User is signed in"],
    hardAssertions: [
      {
        type: "url_contains",
        expected: "/content",
        required: true,
      },
    ],
    aiAssertions: [
      {
        prompt: "Confirm that the content page heading is visible.",
        required: true,
      },
    ],
    steps: [
      {
        stepId: "open-content",
        type: "goto",
        description: "Open the content page",
        target: "/content",
      },
    ],
    ...overrides,
  };
}

describe("case filters", () => {
  it("includes an enabled case matching module, tag, and env filters", () => {
    const matchingCase = buildCase({
      caseId: "CONTENT-READ-001",
      module: "content-management",
      tags: ["content", "readonly"],
      envScope: ["staging", "prod"],
    });
    const nonMatchingCase = buildCase({
      caseId: "BILLING-READ-001",
      module: "billing",
      tags: ["billing", "readonly"],
      envScope: ["staging"],
    });

    const selected = selectCases([matchingCase, nonMatchingCase], {
      module: "content-management",
      tags: ["content"],
      env: "prod",
    });

    assert.deepEqual(
      selected.included.map((testCase) => testCase.caseId),
      ["CONTENT-READ-001"],
    );
    assert.deepEqual(
      selected.excluded.map(({ testCase, reason }) => [testCase.caseId, reason]),
      [["BILLING-READ-001", "module_mismatch"]],
    );
  });

  it("excludes disabled cases with a disabled reason", () => {
    const disabledCase = buildCase({
      caseId: "CONTENT-READ-DISABLED",
      enabled: false,
    });

    const selected = selectCases([disabledCase], {});

    assert.deepEqual(selected.included, []);
    assert.equal(selected.excluded[0]?.testCase.caseId, "CONTENT-READ-DISABLED");
    assert.equal(selected.excluded[0]?.reason, "disabled");
  });

  it("requires all requested tags to be present", () => {
    const allTagsCase = buildCase({
      caseId: "CONTENT-READ-ALL-TAGS",
      tags: ["content", "readonly", "smoke"],
    });
    const partialTagsCase = buildCase({
      caseId: "CONTENT-READ-PARTIAL-TAGS",
      tags: ["content", "smoke"],
    });

    const selected = selectCases([allTagsCase, partialTagsCase], {
      tags: ["content", "readonly"],
    });

    assert.deepEqual(
      selected.included.map((testCase) => testCase.caseId),
      ["CONTENT-READ-ALL-TAGS"],
    );
    assert.deepEqual(
      selected.excluded.map(({ testCase, reason }) => [testCase.caseId, reason]),
      [["CONTENT-READ-PARTIAL-TAGS", "tag_mismatch"]],
    );
  });
});
