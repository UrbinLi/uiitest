import type { AiAssertion } from "../cases/types.js";

export type AiAssertAgent = {
  aiAssert(prompt: string): Promise<void>;
};

export async function runAiAssertions(
  assertions: AiAssertion[],
  agent: AiAssertAgent,
): Promise<void> {
  for (const assertion of assertions) {
    if (assertion.required) {
      await agent.aiAssert(assertion.prompt);
    }
  }
}
