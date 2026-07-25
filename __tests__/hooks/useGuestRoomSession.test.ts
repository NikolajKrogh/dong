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
  assignmentMode: "automatic",
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
  picks: [],
  assignmentPlan: {
    participantCount: 2,
    poolSize: 1,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: 2,
    relaxedFloor: 2,
    feasible: false,
    startable: false,
  },
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
  it("submits a guest's own picks by room-scoped token and refreshes (T029)", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest.fn(async () => createSnapshot());
    const setMyRoomPicksAsGuest = jest.fn(async () => undefined);

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
      setMyRoomPicksAsGuest,
    } as never);

    const observed: { current: UseGuestRoomSessionResult | null } = {
      current: null,
    };
    const Probe = () => {
      observed.current = useGuestRoomSession();
      return null;
    };
    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    const callsBefore = getGuestRoomSnapshot.mock.calls.length;

    await TestRenderer.act(async () => {
      await observed.current?.setMyPicks(["match-1", "match-2"]);
      await flushEffects();
    });

    // Identity is the token alone -- no participant id, no session id (FR-038a).
    expect(setMyRoomPicksAsGuest).toHaveBeenCalledWith("guest-token-1", [
      "match-1",
      "match-2",
    ]);
    // The write is followed by a refresh, so the next replace-all submission is
    // built from fresh picks rather than stale ones.
    expect(getGuestRoomSnapshot.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(observed.current?.isBusy).toBe(false);
    expect(observed.current?.error).toBeNull();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("keeps isBusy true until the post-write refresh settles (T029)", async () => {
    const persistedGrant = createGrant();
    let releaseRefresh: (() => void) | null = null;
    let refreshCount = 0;
    const getGuestRoomSnapshot = jest.fn(async () => {
      refreshCount += 1;
      // Block only the refresh that follows the write, so isBusy can be observed
      // mid-flight. Without this gate the replace-all contract would let a second
      // tap read pre-refresh picks and clobber the first.
      if (refreshCount > 1) {
        await new Promise<void>((resolve) => {
          releaseRefresh = resolve;
        });
      }
      return createSnapshot();
    });
    const setMyRoomPicksAsGuest = jest.fn(async () => undefined);

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
      setMyRoomPicksAsGuest,
    } as never);

    const observed: { current: UseGuestRoomSessionResult | null } = {
      current: null,
    };
    const Probe = () => {
      observed.current = useGuestRoomSession();
      return null;
    };
    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    let pending: Promise<void> | undefined;
    await TestRenderer.act(async () => {
      pending = observed.current?.setMyPicks(["match-1"]);
      await flushEffects();
    });

    expect(observed.current?.isBusy).toBe(true);

    await TestRenderer.act(async () => {
      releaseRefresh?.();
      await pending;
      await flushEffects();
    });

    expect(observed.current?.isBusy).toBe(false);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("surfaces a friendly error when a guest's picks are refused (T029)", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = jest.fn(async () => createSnapshot());
    const setMyRoomPicksAsGuest = jest.fn(async () => {
      throw new Error("pick_limit_exceeded");
    });

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest: jest.fn(),
      getGuestRoomSnapshot,
      setMyRoomPicksAsGuest,
    } as never);

    const observed: { current: UseGuestRoomSessionResult | null } = {
      current: null,
    };
    const Probe = () => {
      observed.current = useGuestRoomSession();
      return null;
    };
    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await observed.current?.setMyPicks(["a", "b", "c"]);
      await flushEffects();
    });

    expect(observed.current?.error).not.toBeNull();
    expect(observed.current?.isBusy).toBe(false);
    // A refused pick must not tear down the session -- the guest is still joined.
    expect(observed.current?.status).toBe("joined");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
