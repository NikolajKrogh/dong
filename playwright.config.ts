import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:18093";
if (baseURL !== "http://127.0.0.1:18093") {
  throw new Error("Run npm run test:e2e so the isolated local stack is configured first.");
}

export default defineConfig({
  testDir: defineBddConfig({
    features: "e2e/features/**/*.feature",
    steps: ["e2e/fixtures.ts", "e2e/steps/**/*.steps.ts"],
  }),
  outputDir: "test-results/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    timezoneId: "UTC",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{
    name: "chromium-phone",
    use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
  }],
});
