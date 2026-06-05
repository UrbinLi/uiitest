import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { parseArgs } from "../../src/cli/args.js";

describe("CLI args", () => {
  it("parses string and boolean flags", () => {
    assert.deepEqual(
      parseArgs([
        "--source",
        "local",
        "--allow-controlled-write",
        "--module",
        "content-management",
      ]),
      {
        source: "local",
        allowControlledWrite: true,
        module: "content-management",
      },
    );
  });

  it("converts kebab-case flags to camelCase keys", () => {
    assert.deepEqual(parseArgs(["--view-id", "v1"]), {
      viewId: "v1",
    });
  });

  it("allows repeated boolean flags", () => {
    assert.deepEqual(parseArgs(["--dry-run", "--dry-run"]), {
      dryRun: true,
    });
  });
});
