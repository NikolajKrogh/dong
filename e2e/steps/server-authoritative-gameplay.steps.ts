import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  ACTIVE_GAME_SNAPSHOT_RPC_PATH,
  buildCompletedActiveGameSnapshot,
  buildActiveGameSnapshot,
  buildActiveGameSnapshotAtSequence,
  ACTIVE_GAME_MEMBER_ID,
  attachActiveTwoClientMocks,
  getActiveTwoClientFixture,
  resetActiveTwoClientFixture,
  seedActiveGameState,
  seedSoloGameState,
  mockTeamDataCatalogue,
} from "./browser-flow.helpers";

const { Given, When, Then, After } = createBdd();

let secondActiveContext: BrowserContext | null = null;
let secondActivePage: Page | null = null;

const secondClient = () => {
  if (!secondActivePage) throw new Error("The second active client is not open.");
  return secondActivePage;
};

const expectInsideViewport = async (page: Page, locator: ReturnType<Page["getByTestId"]>) => {
  await expect
    .poll(async () => {
      const box = await locator.first().boundingBox();
      const viewport = page.viewportSize();
      if (!box || !viewport) return false;
      return (
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      );
    })
    .toBe(true);
  await expect(locator.first()).toHaveCSS("pointer-events", /^(?!none$).+/);
};

const expectInteractiveSheet = async (
  page: Page,
  testId: string,
  rowTestIds: string[] = [],
) => {
  const frame = page.getByTestId(testId);
  await expect(frame).toBeVisible();
  await expectInsideViewport(page, frame);

  for (const rowTestId of rowTestIds) {
    const row = page.getByTestId(rowTestId);
    await expect(row).toBeVisible();
    await expectInsideViewport(page, row);
  }
};

After(async () => {
  await secondActiveContext?.close();
  secondActiveContext = null;
  secondActivePage = null;
});

Given("the active-game snapshot service is mocked", async ({ page }) => {
  await page.route(ACTIVE_GAME_SNAPSHOT_RPC_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildActiveGameSnapshot()),
    });
  });
});

Given(
  "a browser has a persisted multiplayer game and opens the active game",
  async ({ page, baseURL }) => {
    await seedActiveGameState(page);
    await page.goto(`${baseURL ?? "http://localhost:8093"}/gameProgress`, {
      waitUntil: "commit",
    });
    await expect(
      page.getByTestId("GameProgressTabBarContainer").getByText("Matches", {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("GameProgressTabBarContainer")).toBeVisible({
      timeout: 20_000,
    });
  },
);

Given(
  "the active-game snapshot service returns a newer canonical sequence after refresh",
  async ({ page }) => {
    let requestCount = 0;
    await page.route(ACTIVE_GAME_SNAPSHOT_RPC_PATH, async (route) => {
      requestCount += 1;
      const sequence = requestCount === 1 ? 7 : 8;
      const snapshot = buildActiveGameSnapshotAtSequence(sequence, {
        matches:
          sequence === 7
            ? buildActiveGameSnapshot().matches
            : buildActiveGameSnapshot().matches.map((match) => ({
                ...match,
                homeScore: 3,
              })),
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });
  },
);

Given("the active-game completion service is mocked", async ({ page }) => {
  let completed = false;
  await page.route(ACTIVE_GAME_SNAPSHOT_RPC_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        completed ? buildCompletedActiveGameSnapshot() : buildActiveGameSnapshot(),
      ),
    });
  });
  await page.route("**/rest/v1/rpc/end_game_session", async (route) => {
    completed = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "completed", sessionId: "active-game-room-1" }),
    });
  });
});

Given(
  "a local solo game is seeded and shared RPCs are unavailable",
  async ({ page }) => {
    await page.route("**/rest/v1/rpc/**", (route) => route.abort());
    await seedSoloGameState(page);
  },
);

Given("the active two-client gameplay services are mocked", async ({ page }) => {
  resetActiveTwoClientFixture();
  await attachActiveTwoClientMocks(page);
});

When("the browser reloads the active game", async ({ page }) => {
  await page.reload({ waitUntil: "commit" });
  await expect(
    page.getByTestId("GameProgressTabBarContainer").getByText("Matches", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 20_000 });
});

When("the host confirms end game", async ({ page }) => {
  await page.getByTestId("GameProgressMenuButton").click();
  await expectInteractiveSheet(page, "GameActionsSheetFrame", [
    "FooterHomeButton",
    "FooterSetupButton",
    "FooterEndGameButton",
  ]);
  const sheetToggle = page.getByTestId("GameProgressSheetMenuButton");
  await expectInsideViewport(page, sheetToggle);
  await sheetToggle.click();
  await expect(page.getByTestId("GameActionsSheetFrame")).toBeHidden();
  await page.getByTestId("GameProgressMenuButton").click();
  await expectInteractiveSheet(page, "GameActionsSheetFrame", [
    "FooterHomeButton",
    "FooterSetupButton",
    "FooterEndGameButton",
  ]);
  await page.getByTestId("FooterEndGameButton").click();
  await page.getByTestId("EndGameConfirmButton").click();
});

When("the browser opens the solo game", async ({ page, baseURL }) => {
  await page.goto(`${baseURL ?? "http://localhost:8093"}/gameProgress`, {
    waitUntil: "commit",
  });
  await expect(page.getByTestId("GameProgressMatchCard-m1")).toBeVisible({
    timeout: 20_000,
  });
});

Given(
  "a second browser resumes as the active member",
  async ({ browser, baseURL }) => {
    secondActiveContext = await browser.newContext();
    secondActivePage = await secondActiveContext.newPage();
    await attachActiveTwoClientMocks(secondActivePage);
    await seedActiveGameState(secondActivePage, {
      participantId: ACTIVE_GAME_MEMBER_ID,
    });
    await secondActivePage.goto(
      `${baseURL ?? "http://localhost:8093"}/gameProgress`,
      { waitUntil: "commit" },
    );
    await expect(
      secondActivePage.getByTestId("GameProgressTabBarContainer"),
    ).toBeVisible({ timeout: 20_000 });
  },
);

When("the host records a manual goal", async ({ page }) => {
  await page
    .getByLabel("Open quick actions for Manual Home versus Manual Away")
    .click();
  await page
    .getByTestId("ManualScoreIncrement-active-manual-home")
    .click({ force: true });
  await page.getByText("Close", { exact: true }).click({ force: true });
});

Then("the member sees the canonical goal", async () => {
  await expect(
    secondClient().getByTestId("GameProgressMatchCard-active-manual"),
  ).toContainText("1", { timeout: 20_000 });
});

When("the member records a half-drink for themselves", async () => {
  const page = secondClient();
  await page
    .getByTestId("GameProgressTabButton")
    .filter({ hasText: "Players" })
    .click();
  await page.getByTestId(`DrinkIncrement-${ACTIVE_GAME_MEMBER_ID}`).click({ force: true });
});

Then("the host sees the canonical drink total", async ({ page }) => {
  await page
    .getByTestId("GameProgressTabButton")
    .filter({ hasText: "Players" })
    .click();
  await expect(
    page.getByTestId(`GameProgressPlayerCard-${ACTIVE_GAME_MEMBER_ID}`),
  ).toContainText("0.5", { timeout: 20_000 });
});

When("the host adds a match and reassigns using the running-game wizard", async ({ page }) => {
  await mockTeamDataCatalogue(page);
  await page.getByTestId("GameProgressMenuButton").click();
  await page.getByTestId("FooterSetupButton").click();
  await expect(page.getByTestId("SetupWizardRoot")).toBeVisible();
  await page.getByTestId("SetupManualMatchToggle").click();
  for (const [side, name] of [["Home", "Added Home"], ["Away", "Added Away"]]) {
    await page.getByLabel(`${side} Team`, { exact: true }).click();
    await page.getByTestId(`Setup${side}TeamModal`).getByPlaceholder(`Search ${side.toLowerCase()}`).fill(name);
    await page.getByText(`Add "${name}"`, { exact: true }).click();
  }
  await page.getByTestId("SetupAddMatchButton").click();
  await expect(page.getByTestId(/^SetupPoolMatch-/).filter({ hasText: "Added Home" })).toBeVisible();
  await page.getByTestId("SetupWizardStep-assign").click();
  await page.getByTestId("lobby-assignment-mode-host-assigned").click();
  await page.getByTestId("lobby-assignment-player-active-game-participant-1").click();
  await page.getByTestId("lobby-allocate-active-game-participant-1-active-manual").click();
  await page.getByTestId("lobby-allocate-active-game-participant-1-active-alternate").click();
  await page.getByTestId("EditGameSave").click();
  await expect(page.getByTestId("GameProgressTabBarContainer")).toBeVisible({ timeout: 20_000 });
});

Then("both clients retain the canonical score and assignment", async ({ page }) => {
  const fixture = getActiveTwoClientFixture();
  expect(fixture.matches.some(match => match.homeTeamName === "Added Home")).toBe(true);
  expect(
    fixture.assignments.some(
      (assignment) =>
        assignment.participantId === "active-game-participant-1" &&
        assignment.matchId === "active-alternate",
    ),
  ).toBe(true);
  expect(
    fixture.matches.find((match) => match.id === "active-manual")?.homeScore,
  ).toBe(1);
  await page
    .getByTestId("GameProgressTabButton")
    .filter({ hasText: "Matches" })
    .click();
  await expect(
    page.getByTestId("GameProgressMatchCard-active-alternate"),
  ).toBeVisible({ timeout: 20_000 });
  await secondClient()
    .getByTestId("GameProgressTabButton")
    .filter({ hasText: "Matches" })
    .click();
  await expect(
    secondClient().getByTestId("GameProgressMatchCard-active-alternate"),
  ).toBeVisible({ timeout: 20_000 });
});

When("the member reloads the active game", async () => {
  await secondClient().reload({ waitUntil: "commit" });
  await expect(
    secondClient().getByTestId("GameProgressTabBarContainer"),
  ).toBeVisible({ timeout: 20_000 });
});

Then("the member still sees the canonical assignment and drink total", async () => {
  await expect(
    secondClient().getByTestId("GameProgressMatchCard-active-alternate"),
  ).toBeVisible({ timeout: 20_000 });
  await secondClient()
    .getByTestId("GameProgressTabButton")
    .filter({ hasText: "Players" })
    .click();
  await expect(
    secondClient().getByTestId(`GameProgressPlayerCard-${ACTIVE_GAME_MEMBER_ID}`),
  ).toContainText("0.5", { timeout: 20_000 });
});

Then("both clients return Home after canonical completion", async ({ page }) => {
  expect(getActiveTwoClientFixture().state).toBe("completed");
  for (const client of [page, secondClient()]) {
    await expect(client.getByTestId("home-start-game-button")).toBeVisible({ timeout: 20_000 });
    await expect(client.getByTestId("GameProgressMenuButton")).toHaveCount(0);
  }
});

Then("the active game is ready without sync chatter", async ({ page }) => {
  await expect(page.getByText(/Shared game/)).toHaveCount(0);
  await expect(page.getByTestId("GameProgressTabBarContainer")).toBeVisible({
    timeout: 20_000,
  });
});

Then("the canonical active match is visible", async ({ page }) => {
  await expect(page.getByTestId("GameProgressMatchCard-active-match")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByLabel("Open quick actions for Arsenal versus Chelsea"),
  ).toBeVisible();
});

Then("the canonical refreshed score is visible", async ({ page }) => {
  await expect(page.getByTestId("GameProgressMatchCard-active-match")).toContainText(
    "3",
    { timeout: 20_000 },
  );
});

Then("the host returns Home after canonical completion", async ({ page }) => {
  await expect(page.getByTestId("home-start-game-button")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ReassignMatchesButton")).toHaveCount(0);
});

Then("the solo game remains usable without a shared-game banner", async ({ page }) => {
  await expect(page.getByTestId("GameProgressMatchCard-m1")).toBeVisible();
  await expect(page.getByText(/Shared game/)).toHaveCount(0);
});

Then("the host can see reassignment in game actions", async ({ page }) => {
  await expect(page.getByTestId("ReassignMatchesButton")).toHaveCount(0);
  await page.getByTestId("GameProgressMenuButton").click();
  await expect(page.getByTestId("FooterSetupButton")).toContainText("Reassign matches");
  await page.getByTestId("GameProgressSheetMenuButton").click();
});
