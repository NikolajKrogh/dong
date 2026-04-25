import { expect, test } from "@playwright/test";

test("launches the shared shell on web", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();

  await expect
    .poll(async () => {
      const markers = [
        page.getByText("Start New Game"),
        page.getByText("Continue Game"),
        page.getByText("Skip"),
      ];

      for (const marker of markers) {
        if (await marker.first().isVisible().catch(() => false)) {
          return true;
        }
      }

      return false;
    })
    .toBeTruthy();
});