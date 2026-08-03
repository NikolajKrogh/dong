/**
 * Two participants picking their own matches on separate devices (#185, US5.6).
 *
 * The second device is a real second browser context with its own storage,
 * routed through the same module-level mock state as the first. Nothing here
 * scripts what the other participant "would" see: each assertion reads a
 * screen that was updated by the other device's write arriving on a snapshot
 * poll.
 *
 * Timeouts are generous throughout because the propagation being asserted is
 * the app's own ~4s poll — a tighter bound would be testing the poll interval
 * rather than the behaviour.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  HOST_ROOM_PARTICIPANT_ID,
  HOST_ROOM_SESSION_ID,
  SECOND_MEMBER_ID,
  attachSecondDeviceMocks,
  getMockAssignments,
  getMockPicksFor,
  waitForBrowserFlowReady,
} from "./browser-flow.helpers";

const { Given, When, Then, After } = createBdd();

/** How long a cross-device assertion waits: several snapshot polls, not one. */
const PROPAGATION_TIMEOUT_MS = 20_000;

let secondDeviceContext: BrowserContext | null = null;
let secondDevicePage: Page | null = null;

const secondDevice = (): Page => {
  if (!secondDevicePage) {
    throw new Error(
      "The second device has not been opened. Use the 'opens the room on their own device' step first.",
    );
  }
  return secondDevicePage;
};

// A manually created context is not owned by the `page` fixture, so nothing
// else will close it.
After(async () => {
  await secondDeviceContext?.close();
  secondDeviceContext = null;
  secondDevicePage = null;
});

Given(
  "the second member opens the room on their own device",
  async ({ browser, baseURL, $testInfo }) => {
    $testInfo.setTimeout(Math.max($testInfo.timeout, 120_000));

    secondDeviceContext = await browser.newContext();
    secondDevicePage = await secondDeviceContext.newPage();
    await attachSecondDeviceMocks(secondDevicePage, SECOND_MEMBER_ID);

    // Straight to the lobby rather than through a join flow: `useRoomLobby`
    // derives `myRole` purely by finding this participantId on the snapshot
    // roster, and the roster injection has already named it.
    await secondDevicePage.goto(
      `${baseURL ?? "http://localhost:8081"}/lobby/${HOST_ROOM_SESSION_ID}?participantId=${SECOND_MEMBER_ID}`,
      { waitUntil: "commit", timeout: 60_000 },
    );
    await waitForBrowserFlowReady(secondDevicePage, ["Room Lobby"]);

    // Everything a member does lives on the Assign step.
    const assignStep = secondDevicePage.getByTestId("SetupWizardStep-assign");
    await expect(assignStep).toBeVisible({ timeout: PROPAGATION_TIMEOUT_MS });
    await assignStep.click();
  },
);

Then(
  "the second member sees the room read-only, with no way to start the game",
  async () => {
    const page = secondDevice();
    await expect(
      page.getByTestId("lobby-assignment-mode-readonly"),
    ).toBeVisible({ timeout: PROPAGATION_TIMEOUT_MS });
    // No Start Game, and the nav bar's second slot is the disabled placeholder.
    await expect(page.getByTestId("lobby-start-game")).toHaveCount(0);
    await expect(page.getByTestId("SetupWizardFinalDisabled")).toBeVisible();
    // Nor the host's acquisition UI, on the step where it would live.
    await page.getByTestId("SetupWizardStep-matches").click();
    await expect(
      page.getByTestId("SetupAddAllFilteredMatchesButton"),
    ).toHaveCount(0);
    await page.getByTestId("SetupWizardStep-assign").click();
  },
);

Then("the second member sees their own pick panel", async () => {
  const panel = secondDevice().getByTestId("lobby-player-pick-panel");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible({ timeout: PROPAGATION_TIMEOUT_MS });
});

When("the second member picks their first available match", async () => {
  const page = secondDevice();
  // The pick panel lists the pool minus the Common Match (FR-040a), so the
  // first option here is whatever the host left pickable.
  const option = page.getByTestId(/^lobby-player-pick-panel-option-/).first();
  await option.scrollIntoViewIfNeeded();
  await option.click();
});

When("the second member releases their pick", async () => {
  const page = secondDevice();
  // Tapping a held pick again releases it — the same control, which is the
  // point of FR-040's release affordance.
  const option = page.getByTestId(/^lobby-player-pick-panel-option-/).first();
  await option.scrollIntoViewIfNeeded();
  await option.click();
});

Then(
  `the second member's own pick progress reads {string}`,
  async ({}, expected: string) => {
    await expect(
      secondDevice().getByTestId("lobby-player-pick-panel-count"),
    ).toHaveText(expected, { timeout: PROPAGATION_TIMEOUT_MS });
  },
);

Then(
  `the host's device shows the second member at {string}`,
  async ({ page }, expected: string) => {
    // The host never made this write. It arrives on the host's own poll.
    await page.getByTestId("SetupWizardStep-room").click();
    const progress = page.getByTestId(
      `lobby-pick-progress-${SECOND_MEMBER_ID}`,
    );
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toContainText(expected, {
      timeout: PROPAGATION_TIMEOUT_MS,
    });
    await page.getByTestId("SetupWizardStep-assign").click();
  },
);

Then(
  `the second member's device shows the host at {string}`,
  async ({}, expected: string) => {
    const page = secondDevice();
    await page.getByTestId("SetupWizardStep-room").click();
    const progress = page.getByTestId(
      `lobby-pick-progress-${HOST_ROOM_PARTICIPANT_ID}`,
    );
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toContainText(expected, {
      timeout: PROPAGATION_TIMEOUT_MS,
    });
    await page.getByTestId("SetupWizardStep-assign").click();
  },
);

Then(
  "the settled assignments include every participant's own picks",
  async () => {
    const settled = getMockAssignments();

    for (const participantId of [HOST_ROOM_PARTICIPANT_ID, SECOND_MEMBER_ID]) {
      const picked = getMockPicksFor(participantId);
      const held = settled
        .filter((assignment) => assignment.participantId === participantId)
        .map((assignment) => assignment.matchId);

      expect(
        picked.length,
        `${participantId} should have picked at least one match`,
      ).toBeGreaterThan(0);
      picked.forEach((matchId) => expect(held).toContain(matchId));
    }
  },
);
