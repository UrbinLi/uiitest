import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { getDataProfile } from "../../src/data-profiles/registry.js";

describe("data profile registry", () => {
  it("returns readonly-shared with passing setup and cleanup", async () => {
    const profile = getDataProfile("readonly-shared");

    assert.equal(profile.name, "readonly-shared");
    assert.deepEqual(await profile.setup({ runId: "run-1", caseId: "case-1" }), {
      status: "passed",
      notes: [],
      createdMarkers: [],
    });
    assert.deepEqual(await profile.cleanup({ runId: "run-1", caseId: "case-1" }), {
      status: "passed",
      notes: [],
      createdMarkers: [],
    });
  });

  it("throws for unknown data profiles", () => {
    assert.throws(
      () => getDataProfile("missing-profile"),
      /Unknown data profile/,
    );
  });

  it("includes run and case markers for controlled-write-small setup and cleanup", async () => {
    const profile = getDataProfile("controlled-write-small");
    const context = { runId: "run-42", caseId: "case-7" };

    assert.deepEqual(await profile.setup(context), {
      status: "passed",
      notes: ["Using marker qa_run-42_case-7"],
      createdMarkers: ["qa_run-42_case-7"],
    });
    assert.deepEqual(await profile.cleanup(context), {
      status: "passed",
      notes: ["Cleaned marker qa_run-42_case-7"],
      createdMarkers: ["qa_run-42_case-7"],
    });
  });
});
