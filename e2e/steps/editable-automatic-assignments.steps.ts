import { expect, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { HOST_ROOM_PARTICIPANT_ID, HOST_ROOM_SESSION_ID,
  seedHostRoomAuthSession, waitForBrowserFlowReady } from "./browser-flow.helpers";
import { mockEditableAssignments, editableAssignmentState } from "./editable-assignment.helpers";

const { Given, When, Then } = createBdd();

async function enterStartedGame(page: Page) {
  try { await page.waitForURL(/\/gameProgress/, { timeout: 6000 }); }
  catch (error) {
    const returnButton = page.getByRole("button", { name: "Return to game", exact: true });
    if (!await returnButton.isVisible()) throw error;
    await returnButton.click();
    await page.waitForURL(/\/gameProgress/);
  }
}

Given("a host is editing an automatic room with editable assignments", async ({ page, baseURL, $testInfo }) => {
  $testInfo.setTimeout(90_000);
  await mockEditableAssignments(page);
  await seedHostRoomAuthSession(page);
  await page.goto(baseURL!);
  await waitForBrowserFlowReady(page);
  await page.getByTestId("home-start-game-button").click();
  await page.getByTestId("home-create-room-button").click();
  await page.waitForURL(/\/lobby\//);
  await page.getByRole("tab", { name: /^Assign, step/ }).click();
  await expect(page.getByRole("button", { name: "Randomize Matches", exact: true })).toBeVisible();
});

When("the host adjusts a collapsed player's count and restores the default", async ({ page }) => {
  const card = page.getByTestId(`lobby-assignment-player-${HOST_ROOM_PARTICIPANT_ID}`);
  await card.getByRole("button", { name: "Increase alice host's additional matches", exact: true }).click();
  await expect(card.getByTestId(`lobby-allocation-status-${HOST_ROOM_PARTICIPANT_ID}`)).toHaveText("3 left");
  await expect(card.getByRole("checkbox")).toHaveCount(0);
  await card.getByRole("button", { name: "Use default count for Alice Host", exact: true }).click();
  await expect(card.getByTestId(`lobby-allocation-status-${HOST_ROOM_PARTICIPANT_ID}`)).toHaveText("2 left");
});

When("the host randomizes and edits the full match pool in both views", async ({ page }) => {
  await page.getByRole("button", { name: "Randomize Matches", exact: true }).click();
  const card = page.getByTestId(`lobby-assignment-player-${HOST_ROOM_PARTICIPANT_ID}`);
  await expect(card.getByTestId(`lobby-allocation-status-${HOST_ROOM_PARTICIPANT_ID}`)).toHaveText("2 selected");
  await card.getByRole("button", { expanded: false }).first().click();
  await expect(card.getByRole("checkbox")).toHaveCount(4);
  const otherPlayer = page.getByTestId("lobby-assignment-player-editable-member");
  await otherPlayer.getByRole("button", { expanded: false }).first().click();
  await expect(otherPlayer.getByRole("checkbox")).toHaveCount(4);
  await card.getByRole("checkbox", { name: "Cagliari versus Lecce", exact: true }).click();
  await expect(page.getByTestId("lobby-start-game")).toBeDisabled();
  await expect(card.getByText("1 too many", { exact: true })).toBeVisible();
  await card.getByRole("checkbox", { name: "Cardiff City versus Burnley", exact: true }).click();
  await expect(page.getByTestId("lobby-start-game")).toBeEnabled();
  await page.getByRole("button", { name: "Switch to match grid", exact: true }).click();
  await expect(card.getByRole("checkbox", { name: "Cagliari versus Lecce", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Switch to match list", exact: true }).click();
  await expect(otherPlayer.getByRole("button", { expanded: true }).first()).toBeVisible();
  await expect(card.getByRole("checkbox", { name: "Cardiff City versus Burnley", exact: true })).not.toBeChecked();
  await page.addScriptTag({ content: readFileSync(createRequire(process.cwd() + "/package.json").resolve("axe-core"), "utf8") });
  const issues = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (root: string, options: unknown) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run("body", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations;
  });
  expect(issues).toEqual([]);
});

Then("starting preserves the edited automatic selections", async ({ page }) => {
  await page.getByTestId("lobby-start-game").click();
  await enterStartedGame(page);
  const { committed, snapshot, generationCount } = editableAssignmentState();
  expect(committed.filter(a => a.participantId === HOST_ROOM_PARTICIPANT_ID)).toEqual(["two", "three"].map(matchId => ({ participantId: HOST_ROOM_PARTICIPANT_ID, matchId })));
  expect(snapshot.assignmentMode).toBe("automatic");
  expect(generationCount).toBe(1);
});

When("the host starts and edits the running automatic game", async ({ page }) => {
  await page.getByTestId("lobby-start-game").click();
  await enterStartedGame(page);
  await page.goto(new URL("/editGame", page.url()).toString());
  await page.getByRole("tab", { name: /^Assign, step/ }).click();
  const card = page.getByTestId(`lobby-assignment-player-${HOST_ROOM_PARTICIPANT_ID}`);
  await card.getByRole("button", { name: "Increase alice host's additional matches", exact: true }).click();
  await expect(card.getByText("Use default (2)", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Use default count for Alice Host", exact: true }).click();
  await card.getByRole("button", { expanded: false }).first().click();
  await card.getByRole("checkbox", { name: "Fulham versus Newcastle United", exact: true }).click();
  await expect(page.getByTestId("EditGameSave")).toBeDisabled();
  await card.getByRole("checkbox", { name: "Preston North End versus Southampton", exact: true }).click();
});

Then("saving preserves the edited running selections", async ({ page }) => {
  await page.getByTestId("EditGameSave").click();
  await enterStartedGame(page);
  const { committed, snapshot, generationCount } = editableAssignmentState();
  expect(committed.filter(a => a.participantId === HOST_ROOM_PARTICIPANT_ID)).toEqual(["three", "four"].map(matchId => ({ participantId: HOST_ROOM_PARTICIPANT_ID, matchId })));
  expect(generationCount).toBe(1);
  expect(snapshot.sessionId).toBe(HOST_ROOM_SESSION_ID);
});
