import { expect, type Page, type Route } from "@playwright/test";
import axe from "axe-core";
import { createBdd } from "playwright-bdd";
import {
  buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockTeamDataCatalogue, PERSISTED_STORE_KEY,
} from "./browser-flow.helpers";

const { Given, When, Then } = createBdd();
const accessCode = Buffer.alloc(32, 1).toString("base64url");
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");

async function openNotificationControls(page: Page, iphone = false) {
  const { state } = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset());
  await page.addInitScript(({ key, state, iphone }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 0, state: { ...state, soloTracking: {
        grant: { state: "active", grantToken: "A".repeat(43), catalogMatchIds: ["1"], expiresAt: "2099-01-01T00:00:00Z", selectionVersion: 1 },
        pending: null,
      } },
    }));
    Object.defineProperty(navigator, "userAgent", {
      value: iphone ? "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/605.1.15" : "Mozilla/5.0 (Linux; Android 10) Chrome/156.0.0.0 Mobile",
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
  }, { key: PERSISTED_STORE_KEY, state, iphone });

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
      return route.fulfill({ headers, json: {
        ...json, status: registration ? "registered" : request.grant === accessCode ? "available" : "pilot_access_required", publicKey,
      } });
    }
    if (request.operation === "register") {
      expect(request.proof.kind).toBe("solo");
      expect(request.grant).toBe(accessCode);
      registration = { id: request.requestId, credential: accessCode, generation: 1 };
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
Given("a solo game is open in an iPhone browser tab", async ({ page }) => openNotificationControls(page, true));

When("I open Goal notifications from Game actions", async ({ page }) => {
  const sheet = page.getByTestId("GameActionsSheetFrame");
  await expect(sheet.getByRole("heading", { name: "Game actions" })).toBeVisible();
  await expect(sheet.getByLabel("Notification access code")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Goal notifications" }).click();
});
Then("the sheet shows the notification controls and focuses Back", async ({ page }) => {
  const sheet = page.getByTestId("GameActionsSheetFrame");
  await expect(sheet.getByRole("heading", { name: "Goal notifications" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Back to game actions" })).toBeFocused();
  await expect(sheet.getByRole("button", { name: "End Game" })).toHaveCount(0);
  await expect(sheet.getByLabel("Notification access code")).toHaveAttribute("type", "password");
});
When("I go back to Game actions from Goal notifications", async ({ page }) => {
  await page.getByRole("button", { name: "Back to game actions" }).click();
});
Then("the sheet shows the action list and focuses the Goal notifications row", async ({ page }) => {
  const sheet = page.getByTestId("GameActionsSheetFrame");
  await expect(sheet.getByRole("heading", { name: "Game actions" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Goal notifications" })).toBeFocused();
});
When("I close and reopen Game actions", async ({ page }) => {
  await page.getByRole("button", { name: "Close game actions" }).click();
  const openGameActions = page.getByRole("button", { name: "Open game actions" });
  await expect(openGameActions).toBeFocused();
  await openGameActions.click();
});
Then("the sheet starts on the action list", async ({ page }) => {
  const sheet = page.getByTestId("GameActionsSheetFrame");
  await expect(sheet.getByRole("heading", { name: "Game actions" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Goal notifications" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Back to game actions" })).toHaveCount(0);
});

When("I check an approved notification access code", async ({ page }) => {
  await page.getByLabel("Notification access code").fill(accessCode);
  await page.getByRole("button", { name: "Check access" }).click();
});
When("I enable browser notifications", async ({ page }) => {
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
When("I turn off notifications offline and reconnect", async ({ page }) => {
  const url = "**/functions/v1/goal-notifications";
  const offline = (route: Route) => route.abort("internetdisconnected");
  await page.route(url, offline);
  await page.getByRole("switch", { name: "Test alerts" }).click();
  await expect(page.getByText("Notification stop pending until DONG reconnects.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry notification stop" })).toBeVisible();
  await page.unroute(url, offline);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
});
Then("DONG returns to notification access setup", async ({ page }) => {
  await expect(page.getByText("Notifications turned off.")).toBeVisible();
  await expect(page.getByLabel("Notification access code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry notification stop" })).toHaveCount(0);
});
When("browser notification permission is revoked", async ({ page }) => {
  await page.evaluate(() => {
    sessionStorage.setItem("fixture-notification-permission", "denied");
    document.dispatchEvent(new Event("visibilitychange"));
  });
});
Then("DONG shows notification recovery guidance without a new prompt", async ({ page }) => {
  await expect(page.getByText(/Notifications are blocked/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable notifications" })).toHaveCount(0);
});
Then("DONG explains how to open it from the Home Screen", async ({ page }) => {
  await expect(page.getByText(/Share → Add to Home Screen/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable notifications" })).toHaveCount(0);
});
