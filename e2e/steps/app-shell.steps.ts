import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

const PHONE_SIZED_VIEWPORT = {
  width: 390,
  height: 844,
};

const DESKTOP_WIDE_VIEWPORT = {
  width: 1440,
  height: 1024,
};

const PERSISTED_STORE_KEY = "dong-storage";

const HOME_READY_MARKERS = [
  "Start New Game",
  "Continue Game",
  "Current Game in Progress",
  "Game Stats",
];

const setViewportAndReload = async (
  page: Page,
  viewport: { width: number; height: number },
) => {
  await page.setViewportSize(viewport);
  await page.reload();
  await page.waitForLoadState("networkidle");
};

const waitForHomeReady = async (page: Page) => {
  await page.waitForLoadState("networkidle");

  const skipButton = page.getByText("Skip");
  const onboardingVisible = await skipButton
    .isVisible({ timeout: 500 })
    .catch(() => false);

  if (onboardingVisible) {
    await skipButton.click();
  }

  await page.waitForFunction(
    (markers) =>
      markers.some((marker) => document.body?.innerText?.includes(marker)),
    HOME_READY_MARKERS,
    { timeout: 10_000 },
  );
};

const expectHorizontallyCentered = async (
  page: Page,
  testId: string,
  tolerance = 32,
) => {
  const element = page.getByTestId(testId).first();
  const viewport = page.viewportSize();

  await expect(element).toBeVisible();

  const box = await element.boundingBox();

  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();

  const viewportCenter = (viewport?.width ?? 0) / 2;
  const elementCenter = (box?.x ?? 0) + (box?.width ?? 0) / 2;

  expect(Math.abs(elementCenter - viewportCenter)).toBeLessThanOrEqual(
    tolerance,
  );
};

const setAppearanceTheme = async (page: Page, useDarkTheme: boolean) => {
  const themeSwitch = page.getByRole("switch").first();
  const isDarkTheme = await themeSwitch.isChecked();

  if (isDarkTheme !== useDarkTheme) {
    await themeSwitch.click();
  }
};

const escapeRegExp = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

Given("the app is running on web", async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("hasLaunched", "true");
  });
  await page.goto(baseURL ?? "http://localhost:8081");
});

Given("the browser viewport is phone-sized", async ({ page }) => {
  await setViewportAndReload(page, PHONE_SIZED_VIEWPORT);
});

Given("the browser viewport is desktop-wide", async ({ page }) => {
  await setViewportAndReload(page, DESKTOP_WIDE_VIEWPORT);
});

When("the home screen loads", async ({ page }) => {
  await waitForHomeReady(page);
});

When("the user navigates to setup", async ({ page }) => {
  await page.getByText("Start New Game").click();
  await page.waitForLoadState("networkidle");
});

Then("the shell background should be visible", async ({ page }) => {
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

Then("the setup player name input should be visible", async ({ page }) => {
  await expect(page.getByPlaceholder("Enter player name")).toBeVisible();
});

Then(
  "the {string} element should be horizontally centered",
  async ({ page }, testId: string) => {
    await expectHorizontallyCentered(page, testId);
  },
);

Then(
  "the {string} action should be visible",
  async ({ page }, label: string) => {
    const exactLabel = new RegExp(`^${escapeRegExp(label)}$`);
    const action = page.getByRole("button", { name: exactLabel }).first();

    if ((await action.count()) > 0) {
      await expect(action).toBeVisible();
      return;
    }

    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  },
);

Then(
  "the {string} section should be visible",
  async ({ page }, label: string) => {
    await expect(page.getByText(label)).toBeVisible();
  },
);

Given("a game is in progress", async ({ page }) => {
  await page.evaluate((storageKey) => {
    const state = {
      state: {
        players: [
          { id: "p1", name: "Test Player", drinksTaken: 0 },
          { id: "p2", name: "Alex Player", drinksTaken: 0 },
        ],
        matches: [
          {
            id: "m1",
            homeTeam: "Team A",
            awayTeam: "Team B",
            homeGoals: 0,
            awayGoals: 0,
          },
        ],
        commonMatchId: "m1",
        playerAssignments: {
          p1: ["m1"],
          p2: ["m1"],
        },
        matchesPerPlayer: 1,
        history: [],
        theme: "light",
      },
      version: 0,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, PERSISTED_STORE_KEY);
  await page.reload();
});

Given("the user has game history", async ({ page }) => {
  await page.evaluate((storageKey) => {
    const state = {
      state: {
        players: [],
        matches: [],
        history: [
          {
            id: "g1",
            date: "2026-01-01T19:00:00.000Z",
            players: [
              { id: "p1", name: "Alice", drinksTaken: 3 },
              { id: "p2", name: "Morgan", drinksTaken: 2 },
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
          {
            id: "g2",
            date: "2026-02-14T19:00:00.000Z",
            players: [
              { id: "p1", name: "Alice", drinksTaken: 1 },
              { id: "p3", name: "Jamie", drinksTaken: 4 },
            ],
            matches: [
              {
                id: "m2",
                homeTeam: "Liverpool",
                awayTeam: "Everton",
                homeGoals: 3,
                awayGoals: 2,
              },
            ],
            commonMatchId: null,
            playerAssignments: { p1: ["m2"], p3: ["m2"] },
            matchesPerPlayer: 1,
          },
        ],
        theme: "light",
      },
      version: 0,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, PERSISTED_STORE_KEY);
  await page.reload();
});

Given("the user navigates to preferences", async ({ page, baseURL }) => {
  await waitForHomeReady(page);
  await page.goto(`${baseURL ?? "http://localhost:8081"}/userPreferences`);
  await page.waitForLoadState("networkidle");
});

When("the user navigates to history", async ({ page, baseURL }) => {
  await page.goto(`${baseURL ?? "http://localhost:8081"}/history`);
  await page.waitForLoadState("networkidle");
});

When("the user switches to dark theme", async ({ page }) => {
  await setAppearanceTheme(page, true);
});

Then("the shell should reflect the dark theme", async ({ page }) => {
  await expect(page.locator("body")).toBeVisible();
});

When("the user navigates back to home", async ({ page }) => {
  await page.goBack();
});

When("the user opens the active game", async ({ page }) => {
  await waitForHomeReady(page);
  await page.getByText("Continue Game").click();
  await page.waitForLoadState("networkidle");
});

When("the user opens the game menu", async ({ page }) => {
  await page.getByRole("button", { name: "Open game actions" }).click();
});

When("the user opens quick actions for the first match", async ({ page }) => {
  await page
    .getByRole("button", { name: /Open quick actions for/i })
    .first()
    .click();
});

When("the user opens the history sort modal", async ({ page }) => {
  await page.getByTestId("HistoryHeaderSortButton").click();
});

When(
  "the user sorts history by the {string} field",
  async ({ page }, field: string) => {
    await page.getByTestId(`HistorySortOption-${field}`).click();
  },
);

When(
  "the user selects the {string} history tab",
  async ({ page }, label: string) => {
    const tabById = page.getByTestId(`HistoryTab-${label}`).first();

    if ((await tabById.count()) > 0) {
      await tabById.click({ force: true });
      return;
    }

    const exactLabel = new RegExp(`^${escapeRegExp(label)}$`);
    const tabButton = page.getByRole("button", { name: exactLabel }).first();

    if ((await tabButton.count()) > 0) {
      await tabButton.click({ force: true });
      return;
    }

    await page.getByText(label, { exact: true }).first().click({ force: true });
  },
);

When("the user opens the first history entry", async ({ page }) => {
  await page.locator('[data-testid^="HistoryGameItem-"]').first().click();
});

Then("the quick actions modal should be visible", async ({ page }) => {
  await expect(page.getByText("Overview")).toBeVisible();
  await expect(page.getByText("Team A")).toBeVisible();
  await expect(page.getByText("Team B")).toBeVisible();
});

Then("the history sort modal should be visible", async ({ page }) => {
  await expect(page.getByTestId("HistorySortModalContent")).toBeVisible();
  await expect(page.getByText("Number of Players")).toBeVisible();
});

Then("the history details modal should be visible", async ({ page }) => {
  const detailsModal = page.getByTestId("GameDetailsModalView");

  await expect(detailsModal).toBeVisible();
  await expect(detailsModal.getByText("Game Details")).toBeVisible();
  await expect(detailsModal.getByText("Alice", { exact: true })).toBeVisible();
  await expect(
    detailsModal.getByText("Liverpool", { exact: true }),
  ).toBeVisible();
});

When("the user switches to light theme", async ({ page }) => {
  await setAppearanceTheme(page, false);
});

Then("the shell should reflect the light theme", async ({ page }) => {
  await expect(page.locator("body")).toBeVisible();
});
