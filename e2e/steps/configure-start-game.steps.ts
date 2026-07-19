import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  CONFIGURE_START_GAME_MATCH_DISCOVERY_FIXTURES,
  mockConfigureStartGameServices,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

Given("the room configuration and start-game services are mocked", async ({ page }) => {
  await mockConfigureStartGameServices(page);
});

When("the host opens the match configuration modal", async ({ page }) => {
  const openButton = page.getByTestId("lobby-open-configure-matches");
  await openButton.scrollIntoViewIfNeeded();
  await openButton.click();
  await expect(page.getByTestId("configure-matches-modal")).toBeVisible({
    timeout: 10_000,
  });
});

When("the host adds the first two catalog matches", async ({ page }) => {
  for (const fixture of CONFIGURE_START_GAME_MATCH_DISCOVERY_FIXTURES) {
    const addButton = page.getByTestId(`configure-match-add-${fixture.id}`);
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();
  }
});

When("the host closes the match configuration modal", async ({ page }) => {
  await page.getByTestId("configure-matches-close").click();
  await expect(page.getByTestId("configure-matches-modal")).toHaveCount(0);
});

When(
  "the host designates the first added match as the Common Match",
  async ({ page }) => {
    const commonButton = page.getByTestId("lobby-set-common-match-1");
    await expect(commonButton).toBeVisible({ timeout: 10_000 });
    await commonButton.click();
  },
);

When("the host randomizes assignments", async ({ page }) => {
  await page.getByTestId("lobby-randomize-assignments").click();
});

When("the host taps the Start Game button", async ({ page }) => {
  const startButton = page.getByTestId("lobby-start-game");
  await expect(startButton).toBeVisible({ timeout: 10_000 });
  await startButton.click();
});

Then("the host is redirected to the active gameplay dashboard", async ({ page }) => {
  await page.waitForURL(/\/gameProgress/, { timeout: 10_000 });
});

Then(
  "the host sees a configuration error and remains in the lobby",
  async ({ page }) => {
    const error = page.getByTestId("lobby-configure-error");
    await expect(error).toBeVisible({ timeout: 10_000 });
    await expect(error).toContainText(/match/i);
    await expect(page).toHaveURL(/\/lobby\//);
  },
);
