import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { expectNoAxeViolations, readRequiredTestEnv, signIn, test } from "../fixtures";

const { Given, When, Then } = createBdd(test);
const manualMatches = [
  ["Arsenal", "Chelsea"],
  ["Liverpool", "Everton"],
  ["Manchester City", "Manchester United"],
] as const;

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("home-start-game-button")).toBeVisible();
}

async function addManualMatch(page: Page, home: string, away: string) {
  const toggle = page.getByTestId("SetupManualMatchToggle").filter({ visible: true });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await page.getByText("Home Team", { exact: true }).click();
  const homeModal = page.getByTestId("SetupHomeTeamModal");
  await homeModal.getByPlaceholder("Search home").fill(home);
  await homeModal.getByText(home, { exact: true }).click();
  await page.getByText("Away Team", { exact: true }).click();
  const awayModal = page.getByTestId("SetupAwayTeamModal");
  await awayModal.getByPlaceholder("Search away").fill(away);
  await awayModal.getByText(away, { exact: true }).click();
  await page.getByTestId("SetupAddMatchButton").click();
}

async function chooseCommon(page: Page, home = "Arsenal", away = "Chelsea") {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByTestId("CommonMatchCard").filter({ hasText: home }).filter({ hasText: away }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

function commonCard(page: Page) {
  return page.getByTestId(/^GameProgressMatchCard-/).filter({ hasText: "Common" });
}

async function recordGoal(page: Page) {
  await commonCard(page).click();
  const increment = page.getByTestId(/^ManualScoreIncrement-.*-home$/);
  await expect(increment).toBeVisible();
  await expect(increment).toBeEnabled();
  await increment.focus();
  await increment.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Close", { exact: true })).toBeHidden();
  await expect(commonCard(page)).toContainText(/Common\s*1\s*-\s*0/);
}

async function finishGame(page: Page) {
  await page.getByTestId("GameProgressMenuButton").click();
  await page.getByTestId("FooterEndGameButton").click();
  await page.getByTestId("EndGameConfirmButton").click();
  const startButton = page.getByRole("button", { name: "Start New Game", exact: true });
  await expect(startButton).toBeVisible();
  await expect(startButton).toBeEnabled();
}

Given("a player opens the local app", async ({ page }) => {
  await openHome(page);
  await expectNoAxeViolations(page);
});

When("the player configures and starts a solo game", async ({ page }) => {
  await page.getByTestId("home-start-game-button").click();
  await page.getByTestId("home-play-local").click();
  for (const name of ["Alex", "Morgan"]) {
    await page.getByPlaceholder("Enter player name").fill(name);
    await page.getByTestId("SetupAddPlayerButton").click();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  for (const [home, away] of manualMatches) await addManualMatch(page, home, away);
  await chooseCommon(page);
  await page.getByRole("button", { name: "Randomize matches", exact: true }).click();
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await expect(page.getByTestId("GameProgressTabBarContainer")).toBeVisible();
});

When("the player records a goal and a drink", async ({ page }) => {
  await recordGoal(page);
  await page.getByTestId("GameProgressTabButton").filter({ hasText: "Players" }).click();
  await page.getByTestId(/^DrinkIncrement-/).first().click();
  await expect(page.getByTestId(/^GameProgressPlayerCard-/).first()).toContainText("0.5");
});

Then("solo progress survives a reload", async ({ page }) => {
  await page.reload();
  await page.getByTestId("GameProgressTabButton").filter({ hasText: "Matches" }).click();
  await expect(commonCard(page)).toContainText(/Common\s*1\s*-\s*0/);
  await page.getByTestId("GameProgressTabButton").filter({ hasText: "Players" }).click();
  await expect(page.getByTestId(/^GameProgressPlayerCard-/).first()).toContainText("0.5");
});

When("the player finishes the game", async ({ page }) => {
  await finishGame(page);
});

Then("the completed solo game appears in history", async ({ page }) => {
  await page.getByRole("link", { name: /Game Stats/ }).click();
  const game = page.getByTestId(/^HistoryGameItem-/).first();
  await expect(game).toContainText("Alex");
  await expect(game).toContainText("Morgan");
  await game.click();
  await expect(page.getByTestId("GameDetailsModalView")).toContainText("Arsenal");
});

Given("a host signs in to the local app", async ({ page }) => {
  await signIn(page, readRequiredTestEnv("E2E_HOST_EMAIL"));
  await openHome(page);
});

When("the host creates a room and a guest joins", async ({ page, world }) => {
  await page.getByTestId("home-start-game-button").click();
  await page.getByTestId("home-create-room-button").click();
  const code = page.getByTestId("lobby-join-code");
  await expect(code).toHaveText(/^\d{6}$/);
  world.roomId = new URL(page.url()).pathname.split("/").pop();
  const guestPage = await world.newIsolatedPage();
  world.guestPage = guestPage;
  await openHome(guestPage);
  await guestPage.getByTestId("home-start-game-button").click();
  await guestPage.getByTestId("home-join-room-button").click();
  await guestPage.getByLabel("Room Code", { exact: true }).fill((await code.innerText()).trim());
  await guestPage.getByLabel("Guest Name", { exact: true }).fill("Casey");
  await guestPage.getByRole("button", { name: "Join Room", exact: true }).click();
  await expect(guestPage.getByRole("tab", { name: /^Room/ })).toBeVisible();
  await guestPage.getByRole("tab", { name: /^Room/ }).click();
  await expect(guestPage.getByText("E2EHost", { exact: true })).toBeVisible();
  await expect(page.getByText("Casey", { exact: false })).toBeVisible();
});

When("the host configures and starts the shared game", async ({ page, world }) => {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByTestId("SetupMatchScheduleToggle").click();
  await expect(page.getByText("3 matches found", { exact: true })).toBeVisible();
  await page.getByTestId("SetupAddAllFilteredMatchesButton").click();
  await expect(page.getByTestId(/^SetupPoolMatch-/).filter({ hasText: "Liverpool" })).toBeVisible();
  await addManualMatch(page, "Arsenal", "Everton");
  await chooseCommon(page, "Arsenal", "Everton");
  await page.getByRole("button", { name: "Review assignments", exact: true }).click();
  await expect(page.getByRole("button", { name: "E2EHost: 1/1 additional matches", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Casey: 1/1 additional matches", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start with these assignments", exact: true }).click();
  await expect(page.getByTestId("GameProgressTabBarContainer")).toBeVisible();
  const guestPage = world.guestPage!;
  await expect(guestPage.getByTestId("GameProgressTabBarContainer")).toBeVisible();
  await expectNoAxeViolations(page);
});

When("the host records a shared goal", async ({ page }) => {
  await recordGoal(page);
});

Then("the guest sees the shared score", async ({ world }) => {
  await expect(commonCard(world.guestPage!)).toContainText(/Common\s*1\s*-\s*0/);
});

When("the host finishes the shared game", async ({ page }) => {
  await finishGame(page);
});

Then("both browsers see that the shared game ended", async ({ page, world }) => {
  const guestPage = world.guestPage!;
  await expect(guestPage.getByRole("heading", { name: "Game ended by host", exact: true })).toBeVisible();
  await guestPage.getByRole("button", { name: "Go to Home now", exact: true }).click();
  await expect(guestPage.getByRole("button", { name: "Start New Game", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Game Stats/ }).click();
  await expect(page.getByTestId(`HistoryGameItem-${world.roomId}`)).toContainText("Casey");
});

Given("an account owner signs in to the local app", async ({ page }) => {
  await signIn(page, readRequiredTestEnv("E2E_ACCOUNT_EMAIL"));
});

When("the owner changes their username and theme", async ({ page }) => {
  await page.getByRole("button", { name: "Profile & username", exact: true }).click();
  await page.getByTestId("ProfileDisplayNameInput").fill("E2EAccountUpdated");
  await page.getByRole("button", { name: "Save username", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("E2EAccountUpdated", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Appearance/ }).click();
  await page.getByRole("switch", { name: "Dark Mode", exact: true }).check();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: /Appearance.*Dark/ })).toBeVisible();
});

When("the owner signs out and signs in with a fresh browser", async ({ page, world }) => {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in or create account", exact: true })).toBeVisible();
  world.freshSessionPage = await world.newIsolatedPage();
  await signIn(world.freshSessionPage, readRequiredTestEnv("E2E_ACCOUNT_EMAIL"));
});

Then("the saved username and theme are restored", async ({ world }) => {
  const page = world.freshSessionPage!;
  await expect(page.getByText("E2EAccountUpdated", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Appearance/ }).click();
  await expect(page.getByRole("switch", { name: "Dark Mode", exact: true })).toBeChecked();
  await expectNoAxeViolations(page);
});
