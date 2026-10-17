import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  HOST_ROOM_USER_ID,
  PERSISTED_STORE_KEY,
  buildPersistedBrowserStateFromSetupDataset,
  createSetupJourneyDataset,
  mockHostRoomServices,
  seedHostRoomAuthSession,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();
const FRIEND_ID = "00000000-0000-4000-8000-000000000029";
const GAME_ID = "ux-focus-completed-game";
const friend = { account_id: FRIEND_ID, username: "Focus Friend", relationship: "friends", request_id: null };
const accountStats = (accountId: string, username: string) => ({
  account_id: accountId, username, games_participated: 0, total_drinks: 0, average_drinks: null,
});

Given("UX History focus fixtures contain a completed game with an accepted friend", async ({ page }) => {
  await mockHostRoomServices(page);
  await seedHostRoomAuthSession(page);
  for (const table of ["completed_session_summaries", "early_leave_results"]) {
    await page.route(`**/rest/v1/${table}**`, route => route.fulfill({ json: [] }));
  }
  await page.route("**/rest/v1/rpc/list_social_relationships", route => {
    const body = route.request().postDataJSON() as { kind?: string };
    return route.fulfill({ json: { items: body.kind === "friends" ? [friend] : [], next_cursor: null } });
  });
  await page.route("**/rest/v1/rpc/get_history_coplayer_context", route => route.fulfill({ json: [friend] }));
  await page.route("**/rest/v1/rpc/get_personal_history_stats", route => route.fulfill({ json: accountStats(HOST_ROOM_USER_ID, "Captain") }));
  await page.route("**/rest/v1/rpc/get_social_history", route => route.fulfill({ json: {
    scope: "all_time_completed_online",
    viewer: accountStats(HOST_ROOM_USER_ID, "Captain"),
    target: accountStats(FRIEND_ID, friend.username),
    shared: {
      shared_games: 0, viewer_total_drinks: 0, target_total_drinks: 0,
      viewer_average_drinks: null, target_average_drinks: null,
      viewer_higher_count: 0, target_higher_count: 0, tied_count: 0,
    },
    games: { items: [], next_cursor: null },
  } }));

  const setup = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset());
  const fixture = { ...setup, state: { ...setup.state, players: [], matches: [], commonMatchId: null, playerAssignments: {}, history: [{
    id: GAME_ID, date: "2026-10-16T19:00:00.000Z",
    players: [{ id: "focus-friend-player", name: friend.username, drinksTaken: 2, membershipType: "registered", accountId: FRIEND_ID }],
    matches: setup.state.matches, commonMatchId: "m1", playerAssignments: { "focus-friend-player": ["m1"] }, matchesPerPlayer: 1,
  }] } };
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem("hasLaunched", "true");
    if (!localStorage.getItem("ux-history-focus-seeded")) {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem("ux-history-focus-seeded", "true");
    }
  }, { key: PERSISTED_STORE_KEY, value: fixture });
});

When("I open the UX focus game details and its shared comparison", async ({ page }) => {
  await page.goto("/history");
  await page.getByTestId(`HistoryGameItem-${GAME_ID}`).filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "Close game details", exact: true })).toBeVisible();
  await page.getByRole("button", { name: `You & ${friend.username}`, exact: true }).click();
});

Then("UX shared statistics are usable without the background game detail modal", async ({ page }) => {
  await expect.poll(() => new URL(page.url()).searchParams.get("friendId")).toBe(FRIEND_ID);
  await expect(page.getByRole("tab", { name: /Stats$/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("GameDetailsModalView").filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Overall totals", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Compare with ${friend.username}`, exact: true }).click({ trial: true });
});

When("I return from UX shared statistics with browser Back", async ({ page }) => {
  await page.goBack();
});

Then("the original UX focus game details are restored", async ({ page }) => {
  await expect.poll(() => new URL(page.url()).searchParams.get("gameId")).toBe(GAME_ID);
  await expect(page.getByRole("button", { name: "Close game details", exact: true })).toBeVisible();
  await expect(page.getByTestId("GameDetailsModalView").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: `You & ${friend.username}`, exact: true })).toBeVisible();
});
