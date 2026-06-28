import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { createGuestRoomHostFixture } from "../fixtures";
import {
  GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
  buildGuestRoomSessionGrantFromFixture,
  getGuestRoomJoinRpcLastRequest,
  mockGuestRoomRpcServices,
  transitionMockGuestRoomToState,
  waitForBrowserFlowReady,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

Given(
  "the guest room app is running on web",
  async ({ page, baseURL, $testInfo }) => {
    $testInfo.setTimeout(Math.max($testInfo.timeout, 90_000));

    await page.addInitScript(() => {
      globalThis.localStorage.setItem("hasLaunched", "true");
    });

    await page.goto(baseURL ?? "http://localhost:8081", {
      waitUntil: "commit",
      timeout: 60_000,
    });

    await waitForBrowserFlowReady(page);
  },
);

Given(
  "the guest room join screen is running on web",
  async ({ page, baseURL, $testInfo }) => {
    $testInfo.setTimeout(Math.max($testInfo.timeout, 90_000));

    await page.addInitScript(() => {
      globalThis.localStorage.setItem("hasLaunched", "true");
    });

    await page.goto(`${baseURL ?? "http://localhost:8081"}/joinRoom`, {
      waitUntil: "commit",
      timeout: 60_000,
    });
  },
);

Given("the guest room service is mocked", async ({ page }) => {
  await mockGuestRoomRpcServices(page);
});

Given(
  "a guest room session grant is preloaded for the mocked room",
  async ({ page }) => {
    const fixture = createGuestRoomHostFixture();
    const sessionGrant = buildGuestRoomSessionGrantFromFixture({
      fixture,
      guestName: fixture.defaultGuestName,
      guestToken: "restored-guest-token",
    });

    await page.addInitScript(
      ({ storageKey, grant }) => {
        globalThis.localStorage.setItem(storageKey, JSON.stringify(grant));
      },
      {
        storageKey: GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
        grant: sessionGrant,
      },
    );
  },
);

When("the user opens the guest join flow", async ({ page }) => {
  const homeJoinAction = page.getByText("Join Room as Guest", { exact: true });

  await homeJoinAction.scrollIntoViewIfNeeded();
  await homeJoinAction.click();
});

When(
  "the guest joins the mocked room as {string}",
  async ({ page }, guestName: string) => {
    await page.getByLabel("Room Code", { exact: true }).fill("ROOM42");
    await page.getByLabel("Guest Name", { exact: true }).fill(guestName);
    await page.getByText("Join Room", { exact: true }).click();
  },
);

When("the mocked host starts gameplay", async ({ page: _page }) => {
  transitionMockGuestRoomToState("in_play");
});

Then("the guest lobby summary should be visible", async ({ page }) => {
  const roomSummary = page.getByText("Guest Room", { exact: true });

  await roomSummary.scrollIntoViewIfNeeded();
  await expect(roomSummary).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Participants", { exact: true })).toBeVisible();
  // Code must be hidden from guests (FR-0A7: host-only join code)
  await expect(page.getByText(/Room ROOM\d/)).toHaveCount(0);
});



Then(
  "the guest room join request should include the room code {string}",
  async ({ page: _page }, joinCode: string) => {
    expect(getGuestRoomJoinRpcLastRequest()?.join_code).toBe(joinCode);
  },
);

Then(
  "the guest room join request should include the guest token",
  async ({ page: _page }) => {
    expect(getGuestRoomJoinRpcLastRequest()?.guest_token).toMatch(/\S+/);
  },
);

Then(
  "the guest lobby should list the guest participant {string}",
  async ({ page }, guestName: string) => {
    const participantSummary = page.getByText(
      new RegExp(String.raw`${guestName}\s+·\s+guest`),
    );

    await participantSummary.scrollIntoViewIfNeeded();
    await expect(participantSummary).toBeVisible();
  },
);

Then(
  "the guest lobby should explain the temporary guest access for room {string}",
  async ({ page }, _roomCode: string) => {
    await expect(
      page.getByText(
        "Guest access is temporary and only applies to this room on this device.",
        { exact: false },
      ),
    ).toBeVisible();
  },
);

Then(
  "the guest lobby should show the room state {string}",
  async ({ page }, roomState: string) => {
    await expect(
      page.getByText(`Current state: ${roomState}`, { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  },
);
