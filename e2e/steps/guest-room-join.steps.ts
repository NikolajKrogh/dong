import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import { createGuestRoomHostFixture } from "../fixtures";
import { roomSnapshotToGameState } from "../../utils/roomSnapshot";
import {
  GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
  HOST_ROOM_PARTICIPANT_ID,
  HOST_ROOM_SESSION_ID,
  buildGuestRoomSessionGrantFromFixture,
  expireMockGuestGrant,
  expireMockRoomRosterParticipant,
  getLastMockGuestRoomSnapshot,
  getLastMockHostRoomSnapshot,
  getGuestRoomJoinRpcLastRequest,
  getMockGuestRoomSnapshotResponseCount,
  getMockHostRoomSnapshotResponseCount,
  getMockGuestRoomPicks,
  mockHostRoomServices,
  mockGuestRoomRpcServices,
  seedHostRoomAuthSession,
  setHostRoomSnapshotParticipants,
  transitionMockGuestRoomToState,
  waitForBrowserFlowReady,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();
const EXPIRED_GUEST_PARTICIPANT_ID = "expired-guest-participant";
let activeRosterHostPage: Page | null = null;

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
  activeRosterHostPage = null;
  await mockGuestRoomRpcServices(page);
});

Given(
  "the guest room service includes a retained expired guest",
  async ({ page }) => {
    activeRosterHostPage = null;
    await mockGuestRoomRpcServices(
      page,
      createGuestRoomHostFixture({
        sessionId: HOST_ROOM_SESSION_ID,
        participants: [
          {
            id: HOST_ROOM_PARTICIPANT_ID,
            displayName: "Alice Host",
            membershipType: "registered",
            sessionRole: "owner",
            currentDrinkTotal: 0,
          },
          {
            id: EXPIRED_GUEST_PARTICIPANT_ID,
            displayName: "Expired Guest",
            membershipType: "guest",
            sessionRole: "member",
            currentDrinkTotal: 0,
          },
        ],
      }),
    );
  },
);

When(
  "the host opens the same room in another browser tab",
  async ({ context, baseURL }) => {
    activeRosterHostPage = await context.newPage();
    await seedHostRoomAuthSession(activeRosterHostPage);
    await mockHostRoomServices(activeRosterHostPage);
    setHostRoomSnapshotParticipants([
      {
        id: "guest-mocked-participant",
        displayName: "Casey",
        membershipType: "guest",
        sessionRole: "member",
      },
      {
        id: EXPIRED_GUEST_PARTICIPANT_ID,
        displayName: "Expired Guest",
        membershipType: "guest",
        sessionRole: "member",
      },
    ]);

    await activeRosterHostPage.goto(
      `${baseURL ?? "http://localhost:8081"}/lobby/${HOST_ROOM_SESSION_ID}?participantId=${HOST_ROOM_PARTICIPANT_ID}`,
      { waitUntil: "commit", timeout: 60_000 },
    );
    await expect(
      activeRosterHostPage.getByText("Room Lobby", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  },
);

Then("both live rosters should list the expired guest", async ({ page }) => {
  if (!activeRosterHostPage) {
    throw new Error("The host roster page was not opened for this scenario.");
  }
  await expect(
    activeRosterHostPage.getByText("Expired Guest", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Expired Guest", { exact: true })).toBeVisible();
});

When("the expired guest is removed from the active roster", async () => {
  expireMockRoomRosterParticipant(EXPIRED_GUEST_PARTICIPANT_ID);
});

Then(
  "both refreshed rosters hide the guest but keep its game projection",
  async ({ page }) => {
    if (!activeRosterHostPage) {
      throw new Error("The host roster page was not opened for this scenario.");
    }

    const previousGuestResponses = getMockGuestRoomSnapshotResponseCount();
    const previousHostResponses = getMockHostRoomSnapshotResponseCount();
    await expect
      .poll(() => getMockGuestRoomSnapshotResponseCount(), { timeout: 15_000 })
      .toBeGreaterThan(previousGuestResponses);
    await expect
      .poll(() => getMockHostRoomSnapshotResponseCount(), { timeout: 15_000 })
      .toBeGreaterThan(previousHostResponses);

    await expect(
      activeRosterHostPage.getByText("Expired Guest", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Expired Guest", { exact: true })).toHaveCount(
      0,
    );

    const hostSnapshot = getLastMockHostRoomSnapshot();
    const guestSnapshot = getLastMockGuestRoomSnapshot();
    expect(
      hostSnapshot?.participants.some(
        (participant) => participant.id === EXPIRED_GUEST_PARTICIPANT_ID,
      ),
    ).toBe(true);
    expect(
      hostSnapshot?.activeRoster?.some(
        (participant) => participant.id === EXPIRED_GUEST_PARTICIPANT_ID,
      ),
    ).toBe(false);
    expect(
      guestSnapshot?.participants.some(
        (participant) => participant.id === EXPIRED_GUEST_PARTICIPANT_ID,
      ),
    ).toBe(true);
    expect(
      guestSnapshot?.activeRoster?.some(
        (participant) => participant.id === EXPIRED_GUEST_PARTICIPANT_ID,
      ),
    ).toBe(false);

    if (!hostSnapshot || !guestSnapshot) {
      throw new Error("Both refreshed room snapshots are required.");
    }
    expect(
      roomSnapshotToGameState(hostSnapshot).players.map(
        (player) => player.name,
      ),
    ).toContain("Expired Guest");
    expect(
      roomSnapshotToGameState(guestSnapshot).players.map(
        (player) => player.name,
      ),
    ).toContain("Expired Guest");
  },
);

Given(
  "the guest room service is mocked with a near-expiring grant",
  async ({ page }) => {
    await mockGuestRoomRpcServices(page, createGuestRoomHostFixture(), {
      grantExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
  },
);

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

Given(
  "a near-expiring protected guest grant is preloaded",
  async ({ page }) => {
    const fixture = createGuestRoomHostFixture();
    const grant = buildGuestRoomSessionGrantFromFixture({
      fixture,
      guestName: fixture.defaultGuestName,
      guestToken: "near-expiry-test-token",
    });
    await page.addInitScript(
      (record) => {
        globalThis.sessionStorage.setItem(
          "dong.guest-credential.v1",
          JSON.stringify(record),
        );
      },
      {
        kind: "joined",
        token: grant.guestToken,
        participantId: grant.participantId,
        sessionId: grant.sessionId,
        joinCode: grant.joinCode,
        displayName: grant.displayName,
        grantExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
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

When("the guest attempts an unknown room", async ({ page }) => {
  await page.getByLabel("Room Code", { exact: true }).fill("NOCODE");
  await page.getByLabel("Guest Name", { exact: true }).fill("Casey");
  await page.getByText("Join Room", { exact: true }).click();
});

Then(
  "only generic room-unavailable feedback should be visible",
  async ({ page }) => {
    await expect(
      page.getByText(
        "This room is unavailable. Check the code or ask the host for a new invitation.",
        { exact: true },
      ),
    ).toBeVisible();
    const safe = await page.evaluate(() => {
      const visible = document.body.innerText;
      const raw = globalThis.sessionStorage.getItem("dong.guest-credential.v1");
      const token = raw
        ? (JSON.parse(raw) as { token?: string }).token
        : undefined;
      return (
        !visible.includes("NOCODE") && (!token || !visible.includes(token))
      );
    });
    expect(safe).toBe(true);
  },
);

Then(
  "the guest credential should not appear in the URL, local storage, or visible page",
  async ({ page }) => {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = globalThis.sessionStorage.getItem(
            "dong.guest-credential.v1",
          );
          if (!raw) return false;
          const token = (JSON.parse(raw) as { token?: string }).token;
          if (!token) return false;
          return (
            !globalThis.location.href.includes(token) &&
            !Object.keys(globalThis.localStorage).some((key) =>
              globalThis.localStorage.getItem(key)?.includes(token),
            ) &&
            !document.body.innerText.includes(token)
          );
        }),
      )
      .toBe(true);
  },
);

When("the mocked host completes the room", async ({ page: _page }) => {
  transitionMockGuestRoomToState("completed");
});

When("the mocked host closes the room", async ({ page: _page }) => {
  transitionMockGuestRoomToState("closed");
});

When("the guest grant expires on the server", async ({ page: _page }) => {
  expireMockGuestGrant();
});

When("the guest leaves the joined room", async ({ page }) => {
  await page.getByText("Leave Guest Room", { exact: true }).click();
});

Then("a replacement guest credential should be confirmed", async ({ page }) => {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = globalThis.sessionStorage.getItem(
            "dong.guest-credential.v1",
          );
          if (!raw) return false;
          try {
            const record = JSON.parse(raw) as { kind?: string; token?: string };
            return (
              record.kind === "joined" &&
              record.token !== "near-expiry-test-token"
            );
          } catch {
            return false;
          }
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
});

Then("confirmed guest departure should be visible", async ({ page }) => {
  await expect(page.getByText("Guest room left", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          globalThis.sessionStorage.getItem("dong.guest-credential.v1") ===
          null,
      ),
    )
    .toBe(true);
});

Then("the guest should see final-only results", async ({ page }) => {
  await expect(
    page.getByText("Final results only.", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
});

Then("the guest should lose closed-room access", async ({ page }) => {
  await expect(
    page.getByText("Your guest access is no longer valid.", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          globalThis.sessionStorage.getItem("dong.guest-credential.v1") ===
          null,
      ),
    )
    .toBe(true);
});

Then(
  "the guest bearer should be stored only in the browser session",
  async ({ page }) => {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = globalThis.sessionStorage.getItem(
            "dong.guest-credential.v1",
          );
          if (!raw) return null;
          try {
            return (JSON.parse(raw) as { kind?: string }).kind ?? null;
          } catch {
            return "invalid";
          }
        }),
      )
      .toBe("joined");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            globalThis.localStorage.getItem("dong:guest-room-session-grant") ===
            null,
        ),
      )
      .toBe(true);
  },
);

Then("the legacy guest key should be removed", async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          globalThis.localStorage.getItem("dong:guest-room-session-grant") ===
          null,
      ),
    )
    .toBe(true);
});

When("the guest reloads the same browser tab", async ({ page }) => {
  await page.reload({ waitUntil: "commit" });
  await waitForBrowserFlowReady(page);
});

Then(
  "a new browser tab should not inherit the guest bearer",
  async ({ context, page }) => {
    const secondTab = await context.newPage();
    try {
      await secondTab.goto(page.url(), { waitUntil: "commit" });
      await expect
        .poll(() =>
          secondTab.evaluate(
            () =>
              globalThis.sessionStorage.getItem("dong.guest-credential.v1") ===
              null,
          ),
        )
        .toBe(true);
    } finally {
      await secondTab.close();
    }
  },
);

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
