import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { mockTeamDataCatalogue } from "./browser-flow.helpers";
const { Given, When, Then } = createBdd();
Given(
  "the match schedule is open in the {string} theme",
  async ({ page }, theme: string) => {
    await mockTeamDataCatalogue(page);
    await page.route("**/v1/matches**", (route) => route.fulfill({ json: [] }));
    await page.clock.setFixedTime(new Date(2026, 9, 9, 12));
    await page.addInitScript((theme) => {
      localStorage.setItem(
        "dong-storage",
        JSON.stringify({
          state: {
            theme,
            gameMode: "solo",
            players: [{ id: "picker-player", name: "Picker check" }],
            matches: [],
            activeGame: false,
          },
          version: 0,
        }),
      );
    }, theme);
    await page.goto("/setupGame");
    await page.getByTestId("SetupWizardStep-matches").click();
    await page.getByTestId("SetupMatchScheduleToggle").click();
  },
);
When("I tap a date in the Paper calendar", async ({ page, $testInfo }) => {
  await page.getByRole("button", { name: "Match date", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Match date", exact: true }),
  ).toContainText("Oct 9");
  await page.getByRole("button", { name: "Match date", exact: true }).click();
  await page.screenshot({ path: $testInfo.outputPath("calendar.png") });
  await page.getByRole("button", { name: "11", exact: true }).click();
});
Then(
  "the calendar closes and the date is applied without confirmation",
  async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Match date", exact: true }),
    ).toContainText("Oct 11");
  },
);
When(
  "I select an hour and minutes on the Paper clock",
  async ({ page, $testInfo }) => {
    await page.getByRole("button", { name: "Start time", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirm", exact: true }),
    ).toHaveCount(0);
    // The library clock handles pointer events on its overlay, above the numeral labels.
  await page.getByText("14", { exact: true }).click({ force: true });
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start time", exact: true }),
    ).toContainText("15:00");
    await page.getByRole("button", { name: "Start time", exact: true }).click();
    // The library clock handles pointer events on its overlay, above the numeral labels.
  await page.getByText("14", { exact: true }).click({ force: true });
    await page.screenshot({ path: $testInfo.outputPath("clock.png") });
    await page.getByText("30", { exact: true }).click({ force: true });
  },
);
Then(
  "the clock closes and the time is applied without confirmation",
  async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start time", exact: true }),
    ).toContainText("14:30");
    await expect(page.getByTestId("SetupMatchScheduleToggle")).toContainText(
      "14:30",
    );
  },
);
