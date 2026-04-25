import { expect, test } from "@playwright/test";

test("switches the shell theme from preferences on web", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(async () => {
      const markers = [
        page.getByTestId("open-preferences-button"),
        page.getByText("Skip"),
      ];

      for (const marker of markers) {
        if (await marker.isVisible().catch(() => false)) {
          return true;
        }
      }

      return false;
    })
    .toBeTruthy();

  const skipButton = page.getByText("Skip");

  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
  }

  await expect(page.getByTestId("open-preferences-button")).toBeVisible();
  await page.getByTestId("open-preferences-button").click();
  await expect(page.getByText("Settings")).toBeVisible();

  const status = page.getByText(/Current theme:/);
  const switchControl = page.getByTestId("theme-mode-switch");

  await expect(status).toBeVisible();
  await expect(switchControl).toBeVisible();

  const initialStatus = await status.textContent();

  await switchControl.click();

  await expect
    .poll(async () => (await status.textContent())?.trim())
    .not.toBe(initialStatus?.trim());
});