import type { Page, ViewportSize } from "@playwright/test";

export const PHONE_SIZED_VIEWPORT: ViewportSize = {
  width: 390,
  height: 844,
};

export const DESKTOP_WIDE_VIEWPORT: ViewportSize = {
  width: 1440,
  height: 1024,
};

export type ViewportPreset = "phone-sized" | "desktop-wide";

const VIEWPORT_PRESETS: Record<ViewportPreset, ViewportSize> = {
  "phone-sized": PHONE_SIZED_VIEWPORT,
  "desktop-wide": DESKTOP_WIDE_VIEWPORT,
};

export const applyViewportPreset = async (
  page: Page,
  preset: ViewportPreset,
) => {
  await page.setViewportSize(VIEWPORT_PRESETS[preset]);
};
