import {
  stopGoalNotificationInstallation, watchPendingGoalNotificationStop,
} from "../../../features/game-progress/goalNotificationClient";
import type { SavedEnrollment } from "../../../platform/notifications/goalNotificationBrowser";
import { goalNotifications as browser } from "../../../platform/notifications/goalNotifications";

jest.mock("../../../platform/notifications/goalNotifications", () => ({
  goalNotifications: { read: jest.fn(), save: jest.fn(), onResume: jest.fn(), unsubscribe: jest.fn() },
}));
jest.mock("../../../lib/supabase", () => ({
  getSupabasePublicConfig: () => ({ url: "https://project.example", apiKey: "public-key" }),
}));
jest.mock("../../../store/gameStore", () => ({ useGameStore: {} }));

afterEach(() => jest.restoreAllMocks());

it("retries a pending stop on launch and reconnection without replacing a newer enrollment", async () => {
  const pending: SavedEnrollment = {
    owner: "account:old", requestId: "old", pendingStop: true,
    installation: { id: "old", generation: 1, credential: "old-control" },
  };
  const newer: SavedEnrollment = {
    owner: "account:new", requestId: "new",
    installation: { id: "new", generation: 1, credential: "new-control" },
  };
  let saved: SavedEnrollment | null = pending;
  let resume = () => {};
  const remove = jest.fn();
  jest.mocked(browser.read).mockImplementation(() => saved);
  jest.mocked(browser.save).mockImplementation(value => { saved = value; });
  jest.mocked(browser.onResume).mockImplementation(callback => { resume = callback; return remove; });
  const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
  fetch.mockImplementationOnce(async () => {
    saved = newer;
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  });

  const stopWatching = watchPendingGoalNotificationStop();
  await expect(stopGoalNotificationInstallation(pending)).rejects.toThrow("offline");
  expect(saved).toEqual(pending);
  resume();
  await stopGoalNotificationInstallation(pending);

  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetch.mock.calls[1][1]?.body as string)).toEqual({
    operation: "disable", installation: pending.installation,
  });
  expect(saved).toBe(newer);
  expect(browser.unsubscribe).not.toHaveBeenCalled();
  stopWatching();
  expect(remove).toHaveBeenCalledTimes(1);
});
