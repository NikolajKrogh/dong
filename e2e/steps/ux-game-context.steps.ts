import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import {
  ACTIVE_GAME_GUEST_PARTICIPANT_ID, ACTIVE_GAME_PARTICIPANT_ID,
  ACTIVE_GAME_ROOM_ID, ACTIVE_GAME_SNAPSHOT_RPC_PATH, GUEST_ROOM_SNAPSHOT_RPC_PATH,
  PERSISTED_STORE_KEY, buildActiveGameGuestSnapshot, buildActiveGameSnapshot, buildHostRoomAccountRow,
  mockHostRoomServices, seedActiveGameState, seedHostRoomAuthSession, seedSoloGameState,
} from "./browser-flow.helpers";
import { GUEST_CREDENTIAL_STORAGE_KEY } from "../../platform/guestCredential/types";

const { Given, When, Then } = createBdd();
const mutations = new WeakMap<Page, string[]>();

Given("UX context starts a {string} game with controlled services", async ({ page }, role: string) => {
  const commands: string[] = [];
  mutations.set(page, commands);
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/(leave_|complete_|end_|start_|change_|reassign_|set_room_|set_my_room_)/.test(request.url())) commands.push(request.url());
  });
  if (role === "solo") await seedSoloGameState(page);
  else {
    await mockHostRoomServices(page);
    await page.route("**/rest/v1/rpc/bootstrap_account", (route) => route.fulfill({ json: buildHostRoomAccountRow() }));
    await page.route("**/functions/v1/refresh-provider-scores", (route) => route.fulfill({ json: {
      sessionId: ACTIVE_GAME_ROOM_ID, refreshed: 0,
    } }));
    if (role === "registered") await seedHostRoomAuthSession(page);
    await seedActiveGameState(page, role === "guest" ? {
      accessKind: "guest", participantId: ACTIVE_GAME_GUEST_PARTICIPANT_ID,
    } : {});
    await page.route(ACTIVE_GAME_SNAPSHOT_RPC_PATH, (route) => route.fulfill({ json: buildActiveGameSnapshot() }));
    await page.route(GUEST_ROOM_SNAPSHOT_RPC_PATH, (route) => route.fulfill({ json: buildActiveGameGuestSnapshot() }));
    await page.route("**/functions/v1/guest-room-access", async (route) => {
      const { operation } = route.request().postDataJSON() as { operation: string };
      if (operation !== "get_guest_room_snapshot") commands.push(operation);
      await route.fulfill({ json: operation === "get_guest_room_snapshot"
        ? buildActiveGameGuestSnapshot() : { ok: false, code: "not_permitted" } });
    });
    await page.route("**/rest/v1/rpc/get_my_active_room", (route) => route.fulfill({ json: {
      sessionId: ACTIVE_GAME_ROOM_ID, participantId: ACTIVE_GAME_PARTICIPANT_ID, role: "owner", joinCode: "ACTIVE1",
    } }));
    if (role === "guest") {
      await page.addInitScript(({ key, room, participant }) => {
        sessionStorage.setItem(key, JSON.stringify({
          kind: "joined", token: "a".repeat(64), sessionId: room,
          participantId: participant, joinCode: "ACTIVE1", displayName: "Active Guest",
          grantExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        }));
      }, { key: GUEST_CREDENTIAL_STORAGE_KEY, room: ACTIVE_GAME_ROOM_ID, participant: ACTIVE_GAME_GUEST_PARTICIPANT_ID });
    }
  }
  await page.goto("/gameProgress");
  await expect(page.getByRole("button", { name: "Open game actions", exact: true })).toBeVisible({ timeout: 20000 });
  if (role !== "solo") await expect(page.getByText(/Shared game . synced/)).toBeVisible({ timeout: 20000 });
});

When("UX context opens the current configuration action", async ({ page }) => {
  await page.getByRole("button", { name: "Open game actions", exact: true }).click();
  await expect(page.getByTestId("FooterSetupButton")).toBeVisible();
  await page.getByTestId("FooterSetupButton").click();
});

Then("UX context retains the {string} game without navigation mutations", async ({ page }, role: string) => {
  if (role === "solo") await expect(page).toHaveURL(/\/setupGame/);
  else if (role === "registered") {
    await expect(page).toHaveURL(new RegExp("/lobby/" + ACTIVE_GAME_ROOM_ID));
    await expect(page.getByTestId("lobby-in-progress").getByText("Game in progress", { exact: true })).toBeVisible({ timeout: 20000 });
  } else {
    await expect(page.getByTestId("GameRoomStatus")).toBeVisible();
    await expect(page.getByText("Room status is read-only here. The host manages configuration.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close room status", exact: true })).toBeVisible();
  }
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, PERSISTED_STORE_KEY);
  expect(state.players.length).toBeGreaterThan(0);
  expect(state.matches.length).toBeGreaterThan(0);
  if (role !== "solo") {
    expect(state.activeGameContext.mode).toBe("multiplayer");
    expect(state.activeGameContext.sessionId).toBe(ACTIVE_GAME_ROOM_ID);
    expect(state.activeGameContext.accessKind).toBe(role === "guest" ? "guest" : "registered");
  }
  expect(mutations.get(page)).toEqual([]);
});
