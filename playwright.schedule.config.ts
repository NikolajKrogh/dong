import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
const port = 8093;
export default defineConfig({
  testDir: defineBddConfig({ features: "e2e/features/paper-schedule.feature", steps: "e2e/steps/paper-schedule.steps.ts", outputDir: ".features-gen/paper-schedule" }),
  timeout: 30000,
  use: { baseURL: `http://localhost:${port}`, headless: true, screenshot: "only-on-failure" },
  projects: [
    { name: "chromium-phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: { command: `node --dns-result-order=ipv4first node_modules/expo/bin/cli start --web --port ${port}`, port, reuseExistingServer: true },
});
