import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { PERSISTED_STORE_KEY, seedSoloGameState } from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();
async function openExternalPage(page: Page) {
  await page.route("**/ux-external", (route) => route.fulfill({
    contentType: "text/html", body: "<html><body><h1>External test page</h1></body></html>",
  }));
  await page.goto("/ux-external");
}

Given("UX return opens a solo game after an external page", async ({ page }) => {
  await seedSoloGameState(page);
  await openExternalPage(page);
  await page.goto("/gameProgress");
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible({ timeout: 20000 });
});

Given("UX return opens Home after an external page with a saved solo game", async ({ page }) => {
  await seedSoloGameState(page);
  await openExternalPage(page);
  await page.goto("/");
  await expect(page.getByText("Continue Game", { exact: true })).toBeVisible({ timeout: 20000 });
});

Given("UX return selects the Players tab", async ({ page }) => {
  await page.getByTestId("GameProgressTabBarContainer").getByText("Players", { exact: true }).click();
  await expect(page).toHaveURL(/gameTab=players/);
});

When("UX return opens game actions", async ({ page }) => {
  await page.getByRole("button", { name: "Open game actions", exact: true }).click();
  await expect(page.getByTestId("GameActionsSheetTitle")).toBeVisible();
  await expect(page).toHaveURL(/\/taskOverlay\?/);
});

Then("UX return browser Back closes only game actions", async ({ page }) => {
  await page.goBack();
  await expect(page).toHaveURL(/\/gameProgress(?:\?|$)/);
  await expect(page.getByTestId("GameActionsSheetTitle")).toBeHidden();
  await expect(page).toHaveURL(/gameTab=players/);
  await expect(page.getByTestId("GameProgressPlayersList")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeFocused();
});

Then("UX return Forward offers Home recovery for the unmounted caller", async ({ page }) => {
  await page.goForward();
  await expect(page).toHaveURL(/\/taskOverlay\?/);
  await expect(page.getByRole("heading", { name: "This panel is no longer available" })).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByText("Continue Game", { exact: true }).click();
  await expect(page).toHaveURL(/\/gameProgress(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, PERSISTED_STORE_KEY);
  expect(state.players).toHaveLength(2);
  expect(state.history).toHaveLength(0);
});

When("UX return explicitly closes game actions", async ({ page }) => {
  await page.getByRole("button", { name: "Close game actions", exact: true }).click();
  await expect(page).toHaveURL(/\/gameProgress(?:\?|$)/);
  await expect(page.getByTestId("GameActionsSheetTitle")).toBeHidden();
});

Then("UX return the next browser Back leaves DONG", async ({ page }) => {
  await page.goBack();
  await expect(page).toHaveURL(/\/ux-external$/);
  await expect(page.getByRole("heading", { name: "External test page" })).toBeVisible();
});

When("UX return resumes and returns Home three times", async ({ page }) => {
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByText("Continue Game", { exact: true }).click();
    await expect(page).toHaveURL(/\/gameProgress(?:\?|$)/);
    await page.getByRole("button", { name: "Open game actions", exact: true }).click();
    await page.getByTestId("FooterHomeButton").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Continue Game", { exact: true })).toBeVisible();
  }
});

Then("UX return retains the saved game and can leave DONG with one Back", async ({ page }) => {
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, PERSISTED_STORE_KEY);
  expect(state.players).toHaveLength(2);
  expect(state.matches.length).toBeGreaterThan(0);
  expect(state.history).toHaveLength(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/ux-external$/);
});

When("UX return reloads the transient overlay", async ({ page }) => {
  await page.reload();
});

Then("UX return explains the expired panel and recovers to gameplay", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "This panel is no longer available" })).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByText("Continue Game", { exact: true }).click();
  await expect(page).toHaveURL(/\/gameProgress(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible();
});


Given("UX return opens league preferences after an external page", async ({ page }) => {
  await seedSoloGameState(page);
  await openExternalPage(page);
  await page.goto("/userPreferences/leagues");
  await expect(page.getByTestId("DefaultLeaguesRow")).toBeVisible({ timeout: 20000 });
});

When("UX return dismisses default leagues with Back and Close", async ({ page }) => {
  const original = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state.defaultSelectedLeagues, PERSISTED_STORE_KEY);
  await page.getByTestId("DefaultLeaguesRow").click();
  await expect(page.getByText("Set Default Leagues", { exact: true }).last()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/userPreferences\/leagues$/);
  await expect(page.getByTestId("DefaultLeaguesRow")).toBeFocused();
  await page.getByTestId("DefaultLeaguesRow").click();
  await page.getByRole("button", { name: "Close default leagues", exact: true }).click();
  await expect(page).toHaveURL(/\/userPreferences\/leagues$/);
  const current = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state.defaultSelectedLeagues, PERSISTED_STORE_KEY);
  expect(current).toEqual(original);
});


Given("UX return opens gameplay with an ambiguous tab query", async ({ page }) => {
  await seedSoloGameState(page);
  await page.goto("/gameProgress?gameTab=players&gameTab=matches");
});

Then("UX return normalizes to the Matches view safely", async ({ page }) => {
  await expect(page).toHaveURL(/\/gameProgress$/);
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Game in progress", exact: true })).toBeVisible();
});
