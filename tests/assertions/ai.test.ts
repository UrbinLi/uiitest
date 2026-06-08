import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { runAiAssertions, type AiAssertAgent } from "../../src/assertions/ai.js";

describe("AI assertions", () => {
  it("calls aiAssert for required assertions with the assertion prompt", async () => {
    const calls: string[] = [];
    const mockAgent: AiAssertAgent = {
      async aiAssert(prompt: string) {
        calls.push(prompt);
      },
    };

    await runAiAssertions(
      [{ prompt: "The content list is visible", required: true }],
      mockAgent,
    );

    assert.deepEqual(calls, ["The content list is visible"]);
  });

  it("does not send optional assertions to aiAssert", async () => {
    const calls: string[] = [];
    const mockAgent: AiAssertAgent = {
      async aiAssert(prompt: string) {
        calls.push(prompt);
      },
    };

    await runAiAssertions(
      [{ prompt: "The optional hint is visible", required: false }],
      mockAgent,
    );

    assert.deepEqual(calls, []);
  });

  it("runs required assertions in array order", async () => {
    const calls: string[] = [];
    const mockAgent: AiAssertAgent = {
      async aiAssert(prompt: string) {
        calls.push(prompt);
      },
    };

    await runAiAssertions(
      [
        { prompt: "First assertion", required: true },
        { prompt: "Second assertion", required: true },
        { prompt: "Third assertion", required: true },
      ],
      mockAgent,
    );

    assert.deepEqual(calls, [
      "First assertion",
      "Second assertion",
      "Third assertion",
    ]);
  });
});
