import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  CONFIGURE_START_GAME_MATCH_DISCOVERY_FIXTURES,
  HOST_ROOM_PARTICIPANT_ID,
  getMockAssignments,
  getMockHostPicks,
  mockConfigureStartGameServices,
  setHostRoomSnapshotParticipants,
  setMockParticipantPicks,
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

When("the host taps the Start Game button", async ({ page }) => {
  const startButton = page.getByTestId("lobby-start-game");
  await expect(startButton).toBeVisible({ timeout: 10_000 });
  await startButton.click();
});

When(
  "the host raises the matches-per-player count to {int}",
  async ({ page }, target: number) => {
    const increment = page.getByTestId("lobby-matches-per-player-increment");
    const value = page.getByTestId("lobby-matches-per-player-value");
    await expect(increment).toBeVisible({ timeout: 10_000 });

    const current = Number((await value.textContent()) ?? "0");
    for (let step = current; step < target; step += 1) {
      await increment.click();
      // Each click round-trips through the mocked set_room_assignment_settings
      // RPC and the next get_room_snapshot poll before the displayed value updates.
      await expect(value).toHaveText(String(step + 1), { timeout: 10_000 });
    }
  },
);

When(
  "the host switches the assignment mode to {word}",
  async ({ page }, mode: string) => {
    const button = page.getByTestId(`lobby-assignment-mode-${mode}`);
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
  },
);

When(
  "the host attempts to switch the assignment mode to {word}",
  async ({ page }, mode: string) => {
    const button = page.getByTestId(`lobby-assignment-mode-${mode}`);
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
  },
);

When("the host allocates the second added match to themselves", async ({ page }) => {
  const allocateButton = page.getByTestId(
    `lobby-allocate-${HOST_ROOM_PARTICIPANT_ID}-match-2`,
  );
  await expect(allocateButton).toBeVisible({ timeout: 10_000 });
  await allocateButton.click();
});

When("the host declines the mode-switch confirmation", async ({ page }) => {
  await page
    .getByTestId("lobby-assignment-mode-confirm")
    .getByText("Cancel")
    .click();
});

Then("the host sees a mode-switch confirmation dialog", async ({ page }) => {
  await expect(page.getByTestId("lobby-assignment-mode-confirm")).toBeVisible(
    { timeout: 10_000 },
  );
});

Then("the assignment mode remains host-assigned", async ({ page }) => {
  await expect(
    page.getByTestId("lobby-assignment-mode-confirm"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("lobby-assignment-mode-host-assigned"),
  ).toBeVisible({ timeout: 10_000 });
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

Then(
  "the host sees a hard-floor shortfall warning and the Start Game button is disabled",
  async ({ page }) => {
    const warning = page.getByTestId("lobby-start-game-hard-floor-warning");
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("lobby-start-game")).toBeDisabled();
  },
);

// ---------------------------------------------------------------------------
// Player-picked mode (#185). This suite runs one page per scenario and models
// other participants as mock state, so the "second picker" is injected into the
// polled snapshot rather than driven from a second browser context.
// ---------------------------------------------------------------------------

const SECOND_MEMBER_ID = "member-picker-1";

Given("the room has a second registered member", async () => {
  setHostRoomSnapshotParticipants([
    {
      id: SECOND_MEMBER_ID,
      displayName: "Second Picker",
      membershipType: "registered",
      sessionRole: "member",
    },
  ]);
});

Then("the host sees their own pick panel", async ({ page }) => {
  const panel = page.getByTestId("lobby-player-pick-panel");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible({ timeout: 10_000 });
});

Then(
  `the host's pick progress reads {string}`,
  async ({ page }, expected: string) => {
    await expect(
      page.getByTestId("lobby-player-pick-panel-count"),
    ).toHaveText(expected, { timeout: 10_000 });
  },
);

When(
  "the host picks the second added match for themselves",
  async ({ page }) => {
    const option = page.getByTestId(
      "lobby-player-pick-panel-option-match-2",
    );
    await option.scrollIntoViewIfNeeded();
    await option.click();
  },
);

Then(
  "the second member's pick progress is visible in the roster",
  async ({ page }) => {
    // Another participant's progress arrives on the next snapshot poll, which is
    // exactly what FR-042 promises -- and why the assertion waits rather than
    // expecting it synchronously.
    setMockParticipantPicks(SECOND_MEMBER_ID, ["match-2"]);

    const progress = page.getByTestId(
      `lobby-pick-progress-${SECOND_MEMBER_ID}`,
    );
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toHaveText("· 1/1 picked", { timeout: 10_000 });
  },
);

Then("the settled assignments include the host's own pick", async () => {
  const picked = getMockHostPicks();
  const settled = getMockAssignments()
    .filter((assignment) => assignment.participantId === HOST_ROOM_PARTICIPANT_ID)
    .map((assignment) => assignment.matchId);

  expect(picked.length).toBeGreaterThan(0);
  picked.forEach((matchId) => expect(settled).toContain(matchId));
});
