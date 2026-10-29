import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import {
  mockTeamDataCatalogue,
  mockHostRoomServices,
  seedHostRoomAuthSession,
  PERSISTED_STORE_KEY,
  seedSoloGameState,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

Given("Home is open in the browser", async ({ page }) => {
  await seedHostRoomAuthSession(page);
  await mockHostRoomServices(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
});

When("I open Game Stats using the keyboard", async ({ page }) => {
  const card = page.getByRole("link", { name: /^Game Stats/ });
  await expect(card).toHaveAttribute("href", "/history");
  await expect(card.getByText("Game Stats", { exact: true })).toBeVisible();
  await card.focus();
  await page.keyboard.press("Enter");
});

Then("History opens and browser Back returns Home", async ({ page }) => {
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

When("I open Friends using the keyboard", async ({ page }) => {
  await page.getByRole("link", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/userPreferences$/);
  await page.getByTestId("settings-friends-button").focus();
  await page.keyboard.press("Enter");
});

Then("Friends opens and browser Back returns through Settings to Home", async ({ page }) => {
  await expect(page).toHaveURL(/\/friends$/);
  await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/userPreferences$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

Given("a solo game is running in the browser", async ({ page }) => {
  await seedSoloGameState(page);
  await mockTeamDataCatalogue(page);
  await page.route("**/v1/matches**", (route) => route.fulfill({ json: [] }));
  await page.goto("/gameProgress");
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible();
});

When("I open the running game's configuration", async ({ page }) => {
  await page.getByRole("button", { name: "Open game actions", exact: true }).click();
  await page.getByTestId("FooterSetupButton").click();
});

Then("the existing players appear in setup", async ({ page }) => {
  await expect(page).toHaveURL(/\/setupGame/);
  await expect(page.getByTestId("SetupPlayersList").getByText("Alex", { exact: true })).toBeVisible();
  await expect(page.getByTestId("SetupPlayersList").getByText("Morgan", { exact: true })).toBeVisible();
});

When("I return to gameplay using browser Back and refresh", async ({ page }) => {
  await page.goBack();
  await expect(page).toHaveURL(/\/gameProgress(?:\?|$)/);
  await page.reload();
});

Then("the same solo game is still running", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible();
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    PERSISTED_STORE_KEY,
  );
  expect(state.players.map((player: { name: string }) => player.name)).toEqual(["Alex", "Morgan"]);
  expect(state.matches.map((match: { id: string }) => match.id)).toEqual(["m1", "m2"]);
  expect(state.history).toEqual([]);
});
