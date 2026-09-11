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
} from "./browser-flow.helpers";

const { Given, When, Then, After } = createBdd();

let secondActiveContext: BrowserContext | null = null;
let secondActivePage: Page | null = null;

const secondClient = () => {
  if (!secondActivePage) throw new Error("The second active client is not open.");
  return secondActivePage;
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
  await page.getByTestId("FooterEndGameButton").evaluate((element) => {
    (element as HTMLElement).click();
  });
  await page.getByTestId("EndGameConfirmButton").evaluate((element) => {
    (element as HTMLElement).click();
  });
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
      secondActivePage.getByText("Shared game · synced", { exact: true }),
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

When("the host reassigns their match to the alternate fixture", async ({ page }) => {
  await page.getByTestId("ReassignMatchesButton").click();
  await page.getByTestId("ReassignmentMatch-active-manual").evaluate((element) => {
    (element as HTMLElement).click();
  });
  await page.getByTestId("ReassignmentMatch-active-alternate").evaluate((element) => {
    (element as HTMLElement).click();
  });
  await page.getByTestId("ReassignmentSaveButton").evaluate((element) => {
    (element as HTMLElement).click();
  });
  await expect(page.getByText("Shared game · synced", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
});

Then("both clients retain the canonical score and assignment", async ({ page }) => {
  const fixture = getActiveTwoClientFixture();
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
    page.getByTestId("GameProgressMatchCard-active-manual"),
  ).toContainText("1", { timeout: 20_000 });
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
    secondClient().getByText("Shared game · synced", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
});

Then("the member still sees the canonical score and drink total", async () => {
  await expect(
    secondClient().getByTestId("GameProgressMatchCard-active-manual"),
  ).toContainText("1", { timeout: 20_000 });
  await secondClient()
    .getByTestId("GameProgressTabButton")
    .filter({ hasText: "Players" })
    .click();
  await expect(
    secondClient().getByTestId(`GameProgressPlayerCard-${ACTIVE_GAME_MEMBER_ID}`),
  ).toContainText("0.5", { timeout: 20_000 });
});

Then("both clients show the canonical completed state", async ({ page }) => {
  await expect(
    page.getByText("Game complete · results are read-only", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    secondClient().getByText("Game complete · results are read-only", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
});

Then("the active game shows the shared game as synced", async ({ page }) => {
  await expect(page.getByText("Shared game · synced", { exact: true })).toBeVisible({
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

Then("the active game shows the canonical completed state", async ({ page }) => {
  await expect(
    page.getByText("Game complete · results are read-only", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ReassignMatchesButton")).toHaveCount(0);
});

Then("the solo game remains usable without a shared-game banner", async ({ page }) => {
  await expect(page.getByTestId("GameProgressMatchCard-m1")).toBeVisible();
  await expect(page.getByText(/Shared game/)).toHaveCount(0);
});

Then("the host can see the reassignment control", async ({ page }) => {
  await expect(page.getByTestId("ReassignMatchesButton")).toBeVisible({
    timeout: 20_000,
  });
});
