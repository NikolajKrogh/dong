import { expect, type Page } from "@playwright/test";
import axe from "axe-core";
import { createBdd } from "playwright-bdd";
import {
  buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockTeamDataCatalogue, PERSISTED_STORE_KEY,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();
const fixtureCredential = Buffer.alloc(32, 1).toString("base64url");
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");

async function openNotificationControls(page: Page) {
  const { state } = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset());
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 0, state: { ...state, soloTracking: {
        grant: { state: "active", grantToken: "A".repeat(43), catalogMatchIds: ["1"], expiresAt: "2099-01-01T00:00:00Z", selectionVersion: 1 },
        pending: null,
      } },
    }));
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 10) Chrome/156.0.0.0 Mobile",
    });
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => sessionStorage.getItem("fixture-notification-permission") ?? "default",
    });
    const subscription = {
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/local-fixture",
        keys: { p256dh: "fixture-key", auth: "fixture-auth" },
      }),
      unsubscribe: async () => {
        sessionStorage.removeItem("fixture-notification-subscription");
        return true;
      },
    };
    const registration = {
      active: { scriptURL: location.origin + "/goal-push-sw.js" },
      pushManager: {
        getSubscription: async () => sessionStorage.getItem("fixture-notification-subscription") ? subscription : null,
        subscribe: async () => {
          sessionStorage.setItem("fixture-notification-permission", "granted");
          sessionStorage.setItem("fixture-notification-subscription", "yes");
          return subscription;
        },
      },
    };
    Object.defineProperty(navigator, "serviceWorker", { value: {
      register: async () => registration,
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    } });
  }, { key: PERSISTED_STORE_KEY, state });

  let registration: { id: string; credential: string; generation: number } | undefined;
  await page.route("**/functions/v1/goal-notifications", async route => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "apikey, content-type, authorization",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const request = route.request().postDataJSON();
    const json = { ok: true };
    if (request.operation === "status") {
      expect(request).not.toHaveProperty("grant");
      return route.fulfill({ headers, json: {
        ...json, status: registration ? "registered" : "available", publicKey,
      } });
    }
    if (request.operation === "register") {
      expect(request.proof.kind).toBe("solo");
      expect(request).not.toHaveProperty("grant");
      expect(request.target).toBe("android_chrome");
      registration = { id: request.requestId, credential: fixtureCredential, generation: 1 };
      return route.fulfill({ headers, json: { ...json, installation: registration } });
    }
    expect(request.installation).toEqual(registration);
    if (request.operation === "disable") {
      registration = undefined;
      return route.fulfill({ headers, json: { ...json, status: "disabled" } });
    }
    expect(request.operation).toBe("test");
    return route.fulfill({ headers, json: { ...json, outcome: "accepted" } });
  });
  await mockTeamDataCatalogue(page);
  await page.route("**/v1/matches**", route => route.fulfill({ json: [] }));
  await page.goto("/gameProgress");
  await page.getByRole("button", { name: "Open game actions" }).click();
}

Given("a solo game has a controlled notification service", async ({ page }) => openNotificationControls(page));
When("I open Goal notifications from Game actions", async ({ page }) => {
  const sheet = page.getByTestId("GameActionsSheetFrame");
  await expect(sheet.getByRole("heading", { name: "Game actions" })).toBeVisible();
  await expect(sheet.getByLabel("Notification access code")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Goal notifications" }).click();
  await expect(sheet.getByRole("heading", { name: "Goal notifications" })).toBeVisible();
  await expect(sheet.getByLabel("Notification access code")).toHaveCount(0);
});
When("I enable browser notifications", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Enable notifications" })).toBeEnabled();
  expect(await page.evaluate(() => Notification.permission)).toBe("default");
  await page.getByRole("button", { name: "Enable notifications" }).click();
  await expect(page.getByRole("switch", { name: "Test alerts" })).toBeChecked();
});
When("I send a test notification", async ({ page }) => {
  await page.getByRole("button", { name: "Send test notification" }).click();
});
Then("DONG reports push-service acceptance", async ({ page }) => {
  await expect(page.getByText("The push service accepted the test. Check your notification tray.")).toBeVisible();
});
Then("the notification controls pass the accessibility audit", async ({ page }) => {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.getByTestId("GameActionsSheetFrame").evaluate(async node =>
    (await (window as unknown as Window & { axe: typeof axe }).axe.run(node, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(item => item.target) })));
  expect(violations).toEqual([]);
});
When("I turn off browser notifications", async ({ page }) => {
  await page.getByRole("switch", { name: "Test alerts" }).click();
});
Then("DONG confirms the browser notification stop", async ({ page }) => {
  await expect(page.getByText("Notifications turned off.")).toBeVisible();
});
