import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "e2e/playwright",
  testMatch: "accessibility.spec.ts",
  timeout: 45_000,
  workers: 1,
});
