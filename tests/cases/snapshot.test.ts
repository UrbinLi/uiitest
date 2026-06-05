import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createRunId, writeSnapshot } from "../../src/cases/snapshot.js";
import type { StandardCase } from "../../src/cases/types.js";

const completeCase: StandardCase = {
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
};

describe("case snapshots", () => {
  it("writes cases.json under the run snapshot directory", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "midscene-snapshot-"));

    try {
      const snapshotPath = await writeSnapshot({
        rootDir,
        runId: "20260604-120000",
        source: "local",
        sourceRef: "cases/examples/content-readonly.case.json",
        filters: { module: "content-management" },
        cases: [completeCase],
      });

      const expectedPath = join(rootDir, "cases", "snapshots", "20260604-120000", "cases.json");
      assert.equal(snapshotPath, expectedPath);

      const parsed = JSON.parse(await readFile(snapshotPath, "utf8")) as {
        runId: string;
        cases: Array<{ caseId: string }>;
      };
      assert.equal(parsed.runId, "20260604-120000");
      assert.equal(parsed.cases[0]?.caseId, "CONTENT-READ-001");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("creates UTC run IDs as YYYYMMDD-HHMMSS", () => {
    assert.equal(createRunId(new Date("2026-06-04T04:05:06Z")), "20260604-040506");
  });

  it("accepts safe named run IDs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "midscene-snapshot-"));

    try {
      const snapshotPath = await writeSnapshot({
        rootDir,
        runId: "plan-check",
        source: "local",
        sourceRef: "cases/examples/content-readonly.case.json",
        filters: {},
        cases: [completeCase],
      });

      assert.equal(snapshotPath, join(rootDir, "cases", "snapshots", "plan-check", "cases.json"));
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid run IDs before writing snapshots", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "midscene-snapshot-"));

    try {
      for (const runId of ["../escaped", "foo/bar", ".", "..", "", "2026-06-04T04:05:06Z"]) {
        await assert.rejects(
          writeSnapshot({
            rootDir,
            runId,
            source: "local",
            sourceRef: "cases/examples/content-readonly.case.json",
            filters: {},
            cases: [completeCase],
          }),
          /Invalid run ID/,
        );
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
