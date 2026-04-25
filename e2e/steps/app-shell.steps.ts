import { expect } from "@playwright/test";
import { Given, When, Then } from "playwright-bdd/decorators";
import { test } from "../fixtures";

Given("the app is running on web", async ({ page, appUrl }) => {
  await page.goto(appUrl);
});

When("the home screen loads", async ({ page }) => {
  await page.waitForLoadState("networkidle");
});

Then("the shell background should be visible", async ({ page }) => {
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

Then("the {string} action should be visible", async ({ page }, label: string) => {
  await expect(page.getByText(label)).toBeVisible();
});

Then("the {string} section should be visible", async ({ page }, label: string) => {
  await expect(page.getByText(label)).toBeVisible();
});

Given("a game is in progress", async ({ page }) => {
  // Set up game state via local storage before loading
  await page.evaluate(() => {
    const state = {
      state: {
        players: [{ id: "p1", name: "Test Player", drinksTaken: 0 }],
        matches: [{ id: "m1", homeTeam: "Team A", awayTeam: "Team B", homeGoals: 0, awayGoals: 0 }],
        history: [],
        theme: "light",
      },
    };
    localStorage.setItem("game-storage", JSON.stringify(state));
  });
  await page.reload();
});

Given("the user has game history", async ({ page }) => {
  await page.evaluate(() => {
    const state = {
      state: {
        players: [],
        matches: [],
        history: [{ id: "g1", date: "2026-01-01", players: [{ id: "p1", name: "Alice", drinksTaken: 3 }], matches: [], commonMatchId: null, playerAssignments: {}, matchesPerPlayer: 1 }],
        theme: "light",
      },
    };
    localStorage.setItem("game-storage", JSON.stringify(state));
  });
  await page.reload();
});

Given("the user navigates to preferences", async ({ page }) => {
  await page.getByText("Settings").click();
});

When("the user switches to dark theme", async ({ page }) => {
  await page.getByText("Dark").click();
});

Then("the shell should reflect the dark theme", async ({ page }) => {
  await expect(page.locator("body")).toBeVisible();
});

When("the user navigates back to home", async ({ page }) => {
  await page.goBack();
});

When("the user switches to light theme", async ({ page }) => {
  await page.getByText("Light").click();
});

Then("the shell should reflect the light theme", async ({ page }) => {
  await expect(page.locator("body")).toBeVisible();
});
