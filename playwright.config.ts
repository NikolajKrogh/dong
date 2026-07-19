import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import {
  CONFIGURE_START_GAME_COMMAND_API_URL,
  LEGACY_HISTORY_IMPORT_ANON_KEY,
  LEGACY_HISTORY_IMPORT_PUBLISHABLE_KEY,
  LEGACY_HISTORY_IMPORT_SUPABASE_URL,
} from "./e2e/steps/browser-flow.helpers";
import {
  DESKTOP_WIDE_VIEWPORT,
  PHONE_SIZED_VIEWPORT,
} from "./e2e/steps/fixtures";

const testDir = defineBddConfig({
  features: "e2e/features/**/*.feature",
  steps: "e2e/steps/**/*.steps.ts",
});

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? "8093");
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`;

export default defineConfig({
  testDir,
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
    env: {
      // The dev-mode Expo/Metro server does SSR-per-request with no
      // production build, and its heap grows over the course of a long
      // e2e run until it hits Node's default old-space limit and crashes
      // with "FATAL ERROR: Reached heap limit ... JavaScript heap out of
      // memory" (surfaced ERR_CONNECTION_REFUSED downstream once the
      // process died — see specs/019-harden-codebase-foundations/tasks.md
      // T008/T008b). Raising the heap ceiling gives it enough room to
      // finish the suite; GitHub-hosted ubuntu-latest runners have ample
      // RAM to spare for this.
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=6144",
      EXPO_PUBLIC_SUPABASE_URL:
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        LEGACY_HISTORY_IMPORT_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        LEGACY_HISTORY_IMPORT_PUBLISHABLE_KEY,
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        LEGACY_HISTORY_IMPORT_ANON_KEY,
      EXPO_PUBLIC_COMMAND_API_URL:
        process.env.EXPO_PUBLIC_COMMAND_API_URL ??
        CONFIGURE_START_GAME_COMMAND_API_URL,
    },
  },
});
