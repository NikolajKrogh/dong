import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { setHostRoomSnapshotParticipants } from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

Given("the room has two registered members", async () => {
  setHostRoomSnapshotParticipants([
    {
      id: "member-1",
      displayName: "Member One",
      membershipType: "registered",
      sessionRole: "member",
    },
    {
      id: "member-2",
      displayName: "Member Two",
      membershipType: "registered",
      sessionRole: "member",
    },
  ]);
});

Then("the registered Join Room action is visible", async ({ page }) => {
  const joinButton = page.getByTestId("home-join-registered-button");
  await joinButton.scrollIntoViewIfNeeded();
  await expect(joinButton).toBeVisible({ timeout: 10_000 });
});

When("the host leaves the room", async ({ page }) => {
  const leaveButton = page.getByTestId("lobby-leave-button");
  await expect(leaveButton).toBeVisible({ timeout: 10_000 });
  await leaveButton.click();
});

Then("the successor chooser is shown", async ({ page }) => {
  await expect(page.getByTestId("lobby-successor-chooser")).toBeVisible({
    timeout: 10_000,
  });
});

When("the host selects the first successor", async ({ page }) => {
  await page.getByTestId("lobby-successor-member-1").click();
});

Then("the host returns to the home screen", async ({ page }) => {
  await page.waitForURL((url) => !url.pathname.includes("/lobby/"), {
    timeout: 10_000,
  });
});
