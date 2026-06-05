import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildWritebackFields } from "../../src/feishu/writeback.js";

describe("Feishu writeback payloads", () => {
  it("returns exactly the result fields", () => {
    const fields = buildWritebackFields({
      runId: "20260604-120000",
      status: "failed",
      failure: "Expected text was not visible",
      evidenceUrl: "https://example.com/evidence/CONTENT-READ-001",
      executedAt: "2026-06-04T12:00:00.000Z",
    });

    assert.deepEqual(fields, {
      last_run_id: "20260604-120000",
      last_status: "failed",
      last_failure: "Expected text was not visible",
      last_evidence_url: "https://example.com/evidence/CONTENT-READ-001",
      last_executed_at: "2026-06-04T12:00:00.000Z",
    });
  });

  it("uses an empty string for last_failure when failure is undefined", () => {
    const fields = buildWritebackFields({
      runId: "20260604-120000",
      status: "passed",
      evidenceUrl: "https://example.com/evidence/CONTENT-READ-001",
      executedAt: "2026-06-04T12:00:00.000Z",
    });

    assert.equal(fields.last_failure, "");
  });

  it("does not include business case fields", () => {
    const fields = buildWritebackFields({
      runId: "20260604-120000",
      status: "passed",
      evidenceUrl: "https://example.com/evidence/CONTENT-READ-001",
      executedAt: "2026-06-04T12:00:00.000Z",
    });

    for (const businessField of [
      "steps",
      "hard_assertions",
      "ai_assertions",
      "module",
      "title",
      "priority",
    ]) {
      assert.equal(businessField in fields, false, `${businessField} should not be present`);
    }
  });
});
