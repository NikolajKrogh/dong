import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { createGuestRoomHostFixture } from "../fixtures";
import {
  GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
  buildGuestRoomSessionGrantFromFixture,
  getGuestRoomJoinRpcLastRequest,
  getMockGuestRoomPicks,
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
  transitionMockGuestRoomToState("in_progress");
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

Then("the guest is taken into the active game", async ({ page }) => {
  // FR-012 applies to guests too. This used to assert the guest simply *saw*
  // the started state and stayed put — which was the bug, not the contract.
  await page.waitForURL(/\/gameProgress/, { timeout: 15_000 });
  // The guest card must not be left painted over the game behind it.
  await expect(page.getByText("Guest Room", { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Player-picked mode on the guest surface (#185). Before this feature a guest's
// room view was read-only, so these are its first interactive steps.
// ---------------------------------------------------------------------------

/** match-1 stays the Common Match, so the pickable pool is match-2..match-4. */
const PICKABLE_MATCH_IDS = ["match-2", "match-3", "match-4"] as const;

Given(
  "the guest room service is mocked in player-picked mode",
  async ({ page }) => {
    const baseFixture = createGuestRoomHostFixture();

    await mockGuestRoomRpcServices(
      page,
      createGuestRoomHostFixture({
        assignmentMode: "player_picked",
        matchesPerPlayer: 2,
        matches: [
          ...baseFixture.matches,
          ...PICKABLE_MATCH_IDS.map((id, index) => ({
            id,
            sourceProvider: "espn",
            sourceMatchId: `espn-${id}`,
            homeTeamName: ["Liverpool", "Leeds", "Brighton"][index],
            awayTeamName: ["Everton", "Villa", "Wolves"][index],
            kickoffAt: "2026-05-15T18:00:00.000Z",
            homeScore: 0,
            awayScore: 0,
          })),
        ],
      }),
    );
  },
);

Then("the guest should see their own pick panel", async ({ page }) => {
  const panel = page.getByTestId("guest-player-pick-panel");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible({ timeout: 10_000 });
});

Then("the guest should not see a pick panel", async ({ page }) => {
  await expect(page.getByTestId("guest-player-pick-panel")).toHaveCount(0);
});

Then(
  `the guest's pick progress should read {string}`,
  async ({ page }, expected: string) => {
    await expect(page.getByTestId("guest-player-pick-panel-count")).toHaveText(
      expected,
      { timeout: 10_000 },
    );
  },
);

const tapGuestPick = async (
  page: import("@playwright/test").Page,
  matchId: string,
) => {
  const option = page.getByTestId(`guest-player-pick-panel-option-${matchId}`);
  await option.scrollIntoViewIfNeeded();
  await option.click();
};

When("the guest picks the first match in the pool", async ({ page }) => {
  await tapGuestPick(page, PICKABLE_MATCH_IDS[0]);
});

When("the guest picks the second match in the pool", async ({ page }) => {
  await tapGuestPick(page, PICKABLE_MATCH_IDS[1]);
});

When("the guest releases their first pick", async ({ page }) => {
  // Releasing is the same tap: picks are replace-all, so the panel resubmits its
  // set without this match (FR-040).
  await tapGuestPick(page, PICKABLE_MATCH_IDS[0]);
});

Then(
  "the remaining matches in the pool should be unpickable",
  async ({ page }) => {
    // At the cap the unpicked options go inert while the picked ones stay
    // tappable, so a guest can always release one to make room.
    //
    // Asserted via aria-disabled rather than toBeDisabled(): these options render
    // as plain views on web, and Playwright's disabled check only applies to
    // native form controls and ARIA-roled elements.
    await expect(
      page.getByTestId(
        `guest-player-pick-panel-option-${PICKABLE_MATCH_IDS[2]}`,
      ),
    ).toHaveAttribute("aria-disabled", "true");

    // The picked ones must NOT be inert, or a guest at the cap would be stuck.
    await expect(
      page.getByTestId(
        `guest-player-pick-panel-option-${PICKABLE_MATCH_IDS[0]}`,
      ),
    ).not.toHaveAttribute("aria-disabled", "true");
  },
);

Then(
  "the stored guest picks should contain exactly one match",
  async ({ page: _page }) => {
    expect(getMockGuestRoomPicks()).toHaveLength(1);
  },
);
