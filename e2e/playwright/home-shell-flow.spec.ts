import { expect, test } from "@playwright/test";

const PERSISTED_STORE_KEY = "dong-storage";
const HOME_READY_MARKERS = [
  "Start New Game",
  "Continue Game",
  "Current Game in Progress",
  "Game Stats",
];

const dismissOnboardingIfPresent = async (
  page: Parameters<typeof test>[0]["page"],
) => {
  const skipButton = page.getByText("Skip");

  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
  }
};

const waitForHomeReady = async (page: Parameters<typeof test>[0]["page"]) => {
  await page.waitForLoadState("networkidle");
  await dismissOnboardingIfPresent(page);

  await page.waitForFunction(
    (markers) =>
      markers.some((marker) => document.body?.innerText?.includes(marker)),
    HOME_READY_MARKERS,
    { timeout: 10_000 },
  );
};

const seedPersistedHomeState = async (
  page: Parameters<typeof test>[0]["page"],
  state: Record<string, unknown>,
) => {
  await page.goto("/");
  await waitForHomeReady(page);

  await page.evaluate(
    ({ storageKey, persistedState }) => {
      globalThis.localStorage.setItem(
        storageKey,
        JSON.stringify({ state: persistedState, version: 0 }),
      );
    },
    { storageKey: PERSISTED_STORE_KEY, persistedState: state },
  );

  await page.reload();
  await waitForHomeReady(page);
};

const expectHorizontallyCentered = async (
  page: Parameters<typeof test>[0]["page"],
  locator: Parameters<Parameters<typeof expect>[0]["boundingBox"]>[0],
  tolerance = 32,
) => {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();

  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();

  const viewportCenter = (viewport?.width ?? 0) / 2;
  const elementCenter = (box?.x ?? 0) + (box?.width ?? 0) / 2;

  expect(Math.abs(elementCenter - viewportCenter)).toBeLessThanOrEqual(
    tolerance,
  );
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("hasLaunched", "true");
  });
});

test("keeps the primary home action centered", async ({ page }) => {
  await page.goto("/");
  await waitForHomeReady(page);

  const startAction = page.getByTestId("home-start-game-button");

  await expect(startAction).toBeVisible();
  await expectHorizontallyCentered(page, startAction);
});

test("keeps active game summaries centered when the home screen has content", async ({
  page,
}) => {
  await seedPersistedHomeState(page, {
    players: [
      { id: "p1", name: "Alex", drinksTaken: 0 },
      { id: "p2", name: "Morgan", drinksTaken: 0 },
    ],
    matches: [
      {
        id: "m1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        homeGoals: 0,
        awayGoals: 0,
      },
    ],
    history: [
      {
        id: "g1",
        date: "2026-02-14T19:00:00.000Z",
        players: [
          { id: "p1", name: "Alex", drinksTaken: 3 },
          { id: "p2", name: "Morgan", drinksTaken: 1 },
        ],
        matches: [
          {
            id: "m1",
            homeTeam: "Arsenal",
            awayTeam: "Chelsea",
            homeGoals: 2,
            awayGoals: 1,
          },
        ],
        commonMatchId: "m1",
        playerAssignments: { p1: ["m1"], p2: ["m1"] },
        matchesPerPlayer: 1,
      },
    ],
    commonMatchId: "m1",
    playerAssignments: { p1: ["m1"], p2: ["m1"] },
    matchesPerPlayer: 1,
    theme: "light",
  });

  const currentGameCard = page.getByTestId("home-current-game-card");
  const historyStatsCard = page.getByTestId("home-history-stats-card");

  await expect(currentGameCard).toBeVisible();
  await expect(historyStatsCard).toBeVisible();
  await expectHorizontallyCentered(page, currentGameCard);
  await expectHorizontallyCentered(page, historyStatsCard);
});
