import { defineConfig, devices } from "@playwright/test";
import {
  DESKTOP_WIDE_VIEWPORT,
  PHONE_SIZED_VIEWPORT,
} from "./e2e/steps/fixtures";

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? "8081");
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "e2e/playwright",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: PHONE_SIZED_VIEWPORT,
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: DESKTOP_WIDE_VIEWPORT,
      },
    },
  ],
  webServer: {
    command: `npx expo start --web --port ${webPort}`,
    port: webPort,
    reuseExistingServer: true,
  },
});
