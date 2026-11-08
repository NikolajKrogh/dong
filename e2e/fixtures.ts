import { expect, type BrowserContext, type Page } from "@playwright/test";
import { test as base } from "playwright-bdd";
import axe from "axe-core";
import { createRequire } from "node:module";

const nodeRequire = createRequire(`${process.cwd()}/package.json`);

interface JourneyWorld {
  guestPage?: Page;
  freshSessionPage?: Page;
  roomId?: string;
  newIsolatedPage: () => Promise<Page>;
}

export const test = base.extend<{ localServiceTrafficGuard: void; world: JourneyWorld }>({
  world: async ({ browser, baseURL }, provideFixture) => {
    const contexts: { context: BrowserContext; assertLocalServiceTraffic: () => void }[] = [];
    try {
      await provideFixture({ newIsolatedPage: async () => {
        const context = await browser.newContext({
          baseURL,
          viewport: { width: 390, height: 844 },
          timezoneId: "UTC",
          serviceWorkers: "block",
        });
        const assertLocalServiceTraffic = await guardLocalServices(context);
        contexts.push({ context, assertLocalServiceTraffic });
        return context.newPage();
      } });
    } finally {
      try {
        for (const { assertLocalServiceTraffic } of contexts) assertLocalServiceTraffic();
      } finally {
        await Promise.all(contexts.map(({ context }) => context.close()));
      }
    }
  },
  localServiceTrafficGuard: [async ({ context }, provideFixture) => {
    const assertLocalServiceTraffic = await guardLocalServices(context);
    try {
      await provideFixture();
    } finally {
      assertLocalServiceTraffic();
    }
  }, { auto: true }],
});

async function guardLocalServices(context: BrowserContext) {
  const unexpected: string[] = [];
  const serviceUrls = [
    new URL(readRequiredTestEnv("PLAYWRIGHT_BASE_URL")),
    new URL(readRequiredTestEnv("E2E_SUPABASE_URL")),
    new URL("http://127.0.0.1:18080"),
  ];
  for (const url of serviceUrls) {
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["18093", "60321", "18080"].includes(url.port)) {
      throw new Error("E2E services must use the isolated loopback ports; run npm run test:e2e.");
    }
  }
  const localHosts = new Set(serviceUrls.map(url => url.host));
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "raw.githubusercontent.com" && url.pathname.startsWith("/openfootball/football.json/")) {
      await route.fulfill({
        json: { matches: [
          { team1: "Arsenal", team2: "Chelsea" },
          { team1: "Liverpool", team2: "Everton" },
          { team1: "Manchester City", team2: "Manchester United" },
        ] },
        headers: { "access-control-allow-origin": "*" },
      });
      return;
    }
    if (["cdn.jsdelivr.net", "unpkg.com"].includes(url.hostname) && url.pathname.endsWith("/dist/dotlottie-player.wasm")) {
      await route.fulfill({
        path: nodeRequire.resolve("@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm"),
        contentType: "application/wasm",
        headers: { "access-control-allow-origin": "*" },
      });
      return;
    }
    if (localHosts.has(url.host)) {
      await route.continue();
      return;
    }
    if (["document", "fetch", "xhr"].includes(request.resourceType())) {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
    }
    await route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, (socket) => {
    const url = new URL(socket.url());
    if (localHosts.has(url.host)) socket.connectToServer();
    else {
      unexpected.push(`WebSocket ${url.origin}${url.pathname}`);
      socket.close();
    }
  });
  return () => expect(unexpected, "Application traffic must stay on the local test stack").toEqual([]);
}

const fixtureEnvironment = {
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
  E2E_SUPABASE_URL: process.env.E2E_SUPABASE_URL,
  E2E_HOST_EMAIL: process.env.E2E_HOST_EMAIL,
  E2E_ACCOUNT_EMAIL: process.env.E2E_ACCOUNT_EMAIL,
  E2E_PASSWORD: process.env.E2E_PASSWORD,
};

export function readRequiredTestEnv(name: keyof typeof fixtureEnvironment): string {
  const value = fixtureEnvironment[name];
  if (!value) throw new Error(`Missing ${name}; run npm run test:e2e.`);
  return value;
}

export async function signIn(page: Page, email: string) {
  await page.goto("/userPreferences");
  await page.getByRole("button", { name: "Sign in or create account", exact: true }).click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(readRequiredTestEnv("E2E_PASSWORD"));
  await page.getByRole("button", { name: /^Sign in.*→$/ }).click();
  await expect(page.getByRole("button", { name: "Profile & username", exact: true })).toBeVisible();
}

export async function expectNoAxeViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const browserAxe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const result = await browserAxe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return result.violations.map(({ id, impact, description, nodes }) => ({ id, impact, description, targets: nodes.map(node => node.target) }));
  });
  expect(violations, "The journey screen should have no WCAG A/AA violations").toEqual([]);
}
