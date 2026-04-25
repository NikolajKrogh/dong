import { expect, test } from "@playwright/test";

test("renders the migrated home shell controls", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(async () => {
      return page.getByText("Start New Game").isVisible().catch(() => false);
    })
    .toBeTruthy();

  await expect(page.getByText("Start New Game")).toBeVisible();
});