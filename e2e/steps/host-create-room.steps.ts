import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  HOST_ROOM_DISPLAY_NAME,
  mockHostRoomServices,
  seedHostRoomAuthSession,
  waitForBrowserFlowReady,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

Given("the host room service is mocked", async ({ page }) => {
  await mockHostRoomServices(page);
});

Given(
  "a signed-in host is on the home screen",
  async ({ page, baseURL, $testInfo }) => {
    $testInfo.setTimeout(Math.max($testInfo.timeout, 90_000));

    await seedHostRoomAuthSession(page);

    await page.goto(baseURL ?? "http://localhost:8081", {
      waitUntil: "commit",
      timeout: 60_000,
    });

    await waitForBrowserFlowReady(page);
  },
);

When("the host taps the Create Room button", async ({ page }) => {
  const createRoomButton = page.getByTestId("home-create-room-button");

  await createRoomButton.scrollIntoViewIfNeeded();
  await expect(createRoomButton).toBeVisible({ timeout: 10_000 });
  await createRoomButton.click();
});

Then("the host is navigated to the lobby screen", async ({ page }) => {
  await page.waitForURL(/\/lobby\//, { timeout: 10_000 });
});

Then("a 6-digit numeric join code is displayed", async ({ page }) => {
  const joinCode = page.getByTestId("lobby-join-code");

  await expect(joinCode).toBeVisible({ timeout: 10_000 });
  await expect(joinCode).toHaveText(/^\d{6}$/);
});

Then(
  "the host display name appears in the participant list",
  async ({ page }) => {
    const participant = page.getByText(HOST_ROOM_DISPLAY_NAME, { exact: false });

    await expect(participant.first()).toBeVisible({ timeout: 10_000 });
  },
);

Then("the Create Room button is not visible", async ({ page }) => {
  await expect(page.getByTestId("home-create-room-button")).toHaveCount(0);
});
