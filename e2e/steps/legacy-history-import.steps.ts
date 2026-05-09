import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

import {
  expectLegacyHistoryImportToRemainDisabled,
  getLegacyHistoryImportRpcCallCount,
  getLegacyHistoryImportRpcLastRequest,
  mockLegacyHistoryImportServices,
  seedLegacyHistoryImportState,
  waitForBrowserFlowReady,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();

Given("the Supabase import service is mocked", async ({ page }) => {
  await mockLegacyHistoryImportServices(page);
});

Given(
  "the user has a signed-in legacy history ready for import",
  async ({ page }) => {
    await seedLegacyHistoryImportState(page);
  },
);

When("the user starts the legacy history import", async ({ page }) => {
  const importButton = page.getByTestId("LegacyHistoryImportButton");

  await expect(importButton).toBeEnabled();
  await importButton.click();
});

Then("the claimant picker should be visible", async ({ page }) => {
  const modal = page.getByTestId("LegacyHistoryImportClaimantModal");

  await expect(modal).toBeVisible();
  await expect(
    modal.getByText("Choose Your Player", { exact: true }),
  ).toBeVisible();
});

When(
  "the user selects the {string} claimant",
  async ({ page }, claimantName: string) => {
    const modal = page.getByTestId("LegacyHistoryImportClaimantModal");

    await modal.getByText(claimantName, { exact: true }).click();
    await waitForBrowserFlowReady(page, [
      "Import completed successfully. Imported 2, skipped 0, failed 0.",
    ]);
  },
);

Then("the import completion summary should be visible", async ({ page }) => {
  await expect(
    page.getByText(
      "Import completed successfully. Imported 2, skipped 0, failed 0.",
      { exact: true },
    ),
  ).toBeVisible();
});

Then(
  "the import request should preserve guest participant snapshots",
  async () => {
    const request = getLegacyHistoryImportRpcLastRequest();

    expect(request).not.toBeNull();
    expect(request?.sessions).toHaveLength(2);
    expect(
      request?.sessions.map((session) =>
        session.guestParticipants.map((participant) => participant.id),
      ),
    ).toEqual([["jordan-session-a"], ["jordan-session-b"]]);
  },
);

When(
  "the user tries to start the legacy history import again",
  async ({ page }) => {
    await expectLegacyHistoryImportToRemainDisabled(page);
  },
);

Then("the import action should remain disabled", async ({ page }) => {
  await expectLegacyHistoryImportToRemainDisabled(page);
});

Then("the import RPC should only be called once", async () => {
  expect(getLegacyHistoryImportRpcCallCount()).toBe(1);
});
