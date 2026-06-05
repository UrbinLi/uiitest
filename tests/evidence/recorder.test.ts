import { strict as assert } from "node:assert";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createEvidenceRecorder } from "../../src/evidence/recorder.js";

describe("evidence recorder", () => {
  it("creates a case evidence directory and writes evidence logs", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "midscene-evidence-"));
    const caseId = "CONTENT-READ-001";

    const recorder = await createEvidenceRecorder({ evidenceRoot, caseId });

    const directory = await stat(join(evidenceRoot, caseId));
    assert.equal(directory.isDirectory(), true);
    assert.equal(recorder.caseEvidenceDir, join(evidenceRoot, caseId));

    await recorder.step("Open content page", "passed", "Loaded /content");
    await recorder.consoleError("TypeError: Cannot read property 'map' of undefined");
    await recorder.pageError("Page crashed while rendering content");
    await recorder.finish("passed");

    const steps = await readFile(join(recorder.caseEvidenceDir, "steps.jsonl"), "utf8");
    const consoleErrors = await readFile(
      join(recorder.caseEvidenceDir, "console-errors.log"),
      "utf8",
    );
    const pageErrors = await readFile(join(recorder.caseEvidenceDir, "page-errors.log"), "utf8");

    assert.match(steps, /Open content page/);
    assert.match(steps, /"name":"finish"/);
    assert.match(consoleErrors, /Cannot read property 'map'/);
    assert.match(pageErrors, /Page crashed/);
  });
});
