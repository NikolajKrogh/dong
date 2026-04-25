import { test as base } from "@playwright/test";

export const test = base.extend<{ appUrl: string }>({
  appUrl: ["http://localhost:8081", { option: true }],
});
