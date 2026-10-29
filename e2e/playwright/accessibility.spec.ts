import { expect, test, type Page, type TestInfo } from "@playwright/test";
import axe from "axe-core";
import { normalizeEspnScoreboard } from "../../supabase/functions/_shared/football-matches/espnMatchNormalizer";
import { liveBoard } from "../../__tests__/fixtures/matchCatalog/scoreboards";
import { mockTeamDataCatalogue } from "../steps/browser-flow.helpers";

const routes = [
  ["/", "Start New Game"], ["/userPreferences", "Preferences"],
  ["/userPreferences/appearance", "Appearance"], ["/history", "History"],
  ["/setupGame", "Next"], ["/auth", "Sign in"],
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const [route, marker] of routes) {
    test(`${theme} ${route} has no WCAG A/AA violations`, async ({ page }, testInfo) => {
      await page.addInitScript(theme => {
        localStorage.setItem("hasLaunched", "true");
        localStorage.setItem("dong-storage", JSON.stringify({ state: { theme }, version: 0 }));
      }, theme);
      await mockTeamDataCatalogue(page);
      await page.goto(route);
      await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
      await auditAccessibility(page, testInfo);
    });
  }
}

async function auditAccessibility(page: Page, testInfo: TestInfo, selector = "body", name = "page") {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async selector => (window as unknown as Window & { axe: typeof axe }).axe.run(document.querySelector(selector)!, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
  }), selector);
  await testInfo.attach(`${name}-axe-results`, { body: JSON.stringify(results.violations), contentType: "application/json" });
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
  expect(results.violations.map(violation => ({ rule: violation.id, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} corrected balances and captured status remain accessible`, async ({ page }, testInfo) => {
    const catalogSnapshot = {
      ...normalizeEspnScoreboard(liveBoard, "eng.1").matches[0], catalogMatchId: "123", observationVersion: "2",
      lifecycle: "abandoned", homeScore: 1, awayScore: null,
      freshness: { lastAttemptAt: null, lastSuccessfulCheckAt: null, observedAt: null, isStale: false, availabilityReason: null },
    };
    const match = { id: "m1", homeTeam: "Home", awayTeam: "Away", homeGoals: 1, awayGoals: 1, catalogSnapshot };
    const players = [{ id: "p1", name: "Alex", drinksTaken: 4 }];
    const playerAssignments = { p1: ["m1"] };
    await page.addInitScript(state => {
      localStorage.setItem("hasLaunched", "true");
      localStorage.setItem("dong-storage", JSON.stringify({ state, version: 0 }));
    }, { theme, matches: [match], players, playerAssignments, commonMatchId: "m1", history: [
      { id: "g1", date: "2026-10-29T10:00:00Z", matches: [match], players, playerAssignments, commonMatchId: "m1", matchesPerPlayer: 1 },
    ] });
    await mockTeamDataCatalogue(page);
    await page.goto("/gameProgress?gameTab=players");
    await expect(page.getByText("2.0 ahead", { exact: true })).toBeVisible();
    await auditAccessibility(page, testInfo, '[data-testid="GameProgressPlayerCard-p1"]', "ahead");
    await page.goto("/gameProgress");
    const card = page.getByTestId("GameProgressMatchCard-m1");
    await expect(card).toContainText("Abandoned");
    await expect(card).toHaveAccessibleName(/Home/);
    await expect(card).toHaveAccessibleName(/Away/);
    await expect(card).toContainText("—");
    await auditAccessibility(page, testInfo, '[data-testid="GameProgressMatchCard-m1"]', "status");
    await page.goto("/history?gameId=g1");
    await expect(page.getByTestId("GameDetailsSections").getByTestId("HistoryMatchCard-m1")).toContainText("Abandoned");
    await page.getByTestId("GameDetailsModalView").evaluate(async element => {
      const animations: Animation[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) animations.push(...node.getAnimations());
      await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
    });
    await auditAccessibility(page, testInfo, '[data-testid="GameDetailsSections"] [data-testid="HistoryMatchCard-m1"]', "frozen-status");
  });
}
