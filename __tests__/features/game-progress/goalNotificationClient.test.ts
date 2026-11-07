import {
  registerGoalNotificationInstallation, stopGoalNotificationInstallation, watchPendingGoalNotificationStop,
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

it.each([true, false])("persists registration only when the server acknowledges this installation (%s)", async (matchesRequest) => {
  const saved: SavedEnrollment = { owner: "solo:fixture", requestId: "10000000-0000-4000-8000-000000000001" };
  const identity = { owner: saved.owner, proof: { kind: "solo" as const, grantToken: "fixture-grant" } };
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/fixture",
    keys: { p256dh: "fixture-key", auth: "fixture-auth" },
  };
  const installation = { id: matchesRequest ? saved.requestId : "another-installation", credential: "control", generation: 1 };
  jest.mocked(browser.save).mockReset();
  const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true, json: async () => ({ ok: true, installation }),
  } as Response);

  const result = registerGoalNotificationInstallation(saved, identity, "android_chrome", subscription);
  if (matchesRequest) {
    await expect(result).resolves.toEqual(installation);
    expect(browser.save).toHaveBeenCalledWith({ ...saved, installation });
  } else {
    await expect(result).rejects.toThrow("invalid_registration");
    expect(browser.save).not.toHaveBeenCalled();
  }
  expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({
    operation: "register", requestId: saved.requestId, target: "android_chrome", proof: identity.proof, subscription,
  });
});
