import { expect, type Page } from "@playwright/test";

import type { HardAssertion } from "../cases/types.js";

export async function runHardAssertions(
  page: Page,
  assertions: HardAssertion[],
): Promise<void> {
  for (const assertion of assertions) {
    switch (assertion.type) {
      case "url_contains":
        expect(page.url()).toContain(assertion.expected);
        break;
      case "text_visible":
        await expect(
          page.getByText(assertion.expected, { exact: false }),
        ).toBeVisible();
        break;
      case "locator_visible":
        await expect(page.locator(assertion.target)).toBeVisible();
        break;
      case "locator_count":
        await expect(page.locator(assertion.target)).toHaveCount(
          assertion.expected,
        );
        break;
    }
  }
}
