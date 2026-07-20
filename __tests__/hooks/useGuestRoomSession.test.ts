import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  GUEST_ROOM_POLL_INTERVAL_MS,
  useGuestRoomSession,
  type UseGuestRoomSessionResult,
} from "../../hooks/useGuestRoomSession";
import type {
  GuestRoomSessionGrant,
  GuestRoomSnapshot,
} from "../../types/guestRoom";
import {
  clearGuestRoomSessionGrant,
  readGuestRoomSessionGrant,
  saveGuestRoomSessionGrant,
} from "../../utils/guestRoom";
import { getGuestRoomRpcClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getGuestRoomRpcClient: jest.fn(),
}));

jest.mock("../../utils/guestRoom", () => {
  const actual = jest.requireActual("../../utils/guestRoom");

  return {
    ...actual,
    readGuestRoomSessionGrant: jest.fn(async () => null),
    saveGuestRoomSessionGrant: jest.fn(async (grant) => grant),
    clearGuestRoomSessionGrant: jest.fn(async () => undefined),
  };
});

const mockGetGuestRoomRpcClient = jest.mocked(getGuestRoomRpcClient);
const mockClearGuestRoomSessionGrant = jest.mocked(clearGuestRoomSessionGrant);
const mockReadGuestRoomSessionGrant = jest.mocked(readGuestRoomSessionGrant);
const mockSaveGuestRoomSessionGrant = jest.mocked(saveGuestRoomSessionGrant);

const createGrant = (
  overrides: Partial<GuestRoomSessionGrant> = {},
): GuestRoomSessionGrant => ({
  guestToken: "guest-token-1",
  participantId: "guest-1",
  sessionId: "session-1",
  joinCode: "ROOM42",
  displayName: "Casey",
  ...overrides,
});

const createSnapshot = (
  overrides: Partial<GuestRoomSnapshot> = {},
): GuestRoomSnapshot => ({
  sessionId: "session-1",
  joinCode: "ROOM42",
  state: "joinable",
  commonMatchId: "match-1",
  participants: [
    {
      id: "owner-1",
      displayName: "Host Owner",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
    {
      id: "guest-1",
      displayName: "Casey",
      membershipType: "guest",
      sessionRole: "member",
      currentDrinkTotal: 0,
    },
  ],
  matches: [],
  assignments: [],
  ...overrides,
});

const flushEffects = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("useGuestRoomSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("restores a persisted guest grant into a joined session", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest.fn(async () => createSnapshot());

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomSessionResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    expect(getGuestRoomSnapshot).toHaveBeenCalledWith("guest-token-1");
    expect(observedHook?.status).toBe("joined");
    expect(observedHook?.session?.grant.guestToken).toBe("guest-token-1");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("refreshes the current room snapshot and keeps the persisted grant", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest
      .fn()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot({ state: "in_play" }));

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomSessionResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await observedHook?.refreshRoom();
    });

    expect(getGuestRoomSnapshot).toHaveBeenCalledTimes(2);
    expect(mockSaveGuestRoomSessionGrant).toHaveBeenCalledWith(persistedGrant);
    expect(observedHook?.session?.snapshot.state).toBe("in_play");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("polls the joined room snapshot so host gameplay transitions appear without rejoining", async () => {
    jest.useFakeTimers();

    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest
      .fn()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot({ state: "in_play" }));

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomSessionResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(GUEST_ROOM_POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getGuestRoomSnapshot).toHaveBeenCalledTimes(2);
    expect(observedHook?.session?.snapshot.state).toBe("in_play");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("clears the persisted grant and marks the session expired when the server rejects it as expired", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest.fn(async () => {
      throw new Error("guest_token_expired");
    });

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomSessionResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalledTimes(1);
    expect(observedHook?.status).toBe("expired");
    expect(observedHook?.session).toBeNull();
    expect(observedHook?.error).toBe(
      "Your guest access expired. Rejoin the room to continue.",
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("keeps the current session when a refresh fails for a non-expired reason", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest
      .fn()
      .mockResolvedValueOnce(createSnapshot())
      .mockRejectedValueOnce(new Error("network down"));

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomSessionResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await observedHook?.refreshRoom();
    });

    expect(mockClearGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.session?.grant.guestToken).toBe("guest-token-1");
    expect(observedHook?.error).toBe("Unable to refresh the room right now.");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("removes the persisted grant when the guest leaves the room", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest.fn(async () => createSnapshot());

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomSessionResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await observedHook?.leaveRoom();
    });

    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalled();
    expect(observedHook?.status).toBe("idle");
    expect(observedHook?.session).toBeNull();
    expect(observedHook?.error).toBeNull();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
