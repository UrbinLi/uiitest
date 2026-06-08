import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { safetyDecision } from "../../src/safety/safety.js";

describe("safety decision", () => {
  it("allows readonly cases when readonly is allowed", () => {
    assert.deepEqual(safetyDecision("readonly", "readonly"), { allowed: true });
  });

  it("rejects controlled-write cases when only readonly is allowed", () => {
    assert.deepEqual(safetyDecision("controlled-write", "readonly"), {
      allowed: false,
      reason: "safety_level_not_allowed",
    });
  });

  it("allows dangerous-write cases when dangerous-write is allowed", () => {
    assert.deepEqual(safetyDecision("dangerous-write", "dangerous-write"), {
      allowed: true,
    });
  });

  it("allows readonly cases when controlled-write is allowed", () => {
    assert.deepEqual(safetyDecision("readonly", "controlled-write"), {
      allowed: true,
    });
  });
});
