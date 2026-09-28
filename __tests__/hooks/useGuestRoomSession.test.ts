import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";
import { useGameStore } from "../../store/store";

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
  createGuestRoomRotationId,
  createGuestRoomToken,
  readAndRemoveLegacyGuestRoomSessionGrant,
  readGuestRoomPendingJoin,
  readGuestRoomPendingLeave,
  readGuestRoomPendingRotation,
  saveGuestRoomPendingLeave,
  saveGuestRoomPendingRotation,
  readGuestRoomSessionGrant,
  saveGuestRoomSessionGrant,
} from "../../utils/guestRoom";
import {
  getGuestRoomRpcClient,
  type GuestRoomRpcClient,
} from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getGuestRoomRpcClient: jest.fn(),
}));

jest.mock("../../utils/guestRoom", () => {
  const actual = jest.requireActual<typeof import("../../utils/guestRoom")>("../../utils/guestRoom");

  return {
    ...actual,
    readAndRemoveLegacyGuestRoomSessionGrant: jest.fn(async () => null),
    readGuestRoomPendingJoin: jest.fn(async () => null),
    readGuestRoomPendingLeave: jest.fn(async () => null),
    saveGuestRoomPendingLeave: jest.fn(async () => undefined),
    readGuestRoomPendingRotation: jest.fn(async () => null),
    saveGuestRoomPendingRotation: jest.fn(async () => undefined),
    createGuestRoomToken: jest.fn(async () => "d".repeat(64)),
    createGuestRoomRotationId: jest.fn(async () => "00000000-0000-4000-8000-000000000001"),
    saveGuestRoomPendingJoin: jest.fn(async () => undefined),
    readGuestRoomSessionGrant: jest.fn(async () => null),
    saveGuestRoomSessionGrant: jest.fn(async (grant) => grant),
    clearGuestRoomSessionGrant: jest.fn(async () => undefined),
  };
});

const mockGetGuestRoomRpcClient = jest.mocked(getGuestRoomRpcClient);
const mockClearGuestRoomSessionGrant = jest.mocked(clearGuestRoomSessionGrant);
const mockReadLegacyGrant = jest.mocked(readAndRemoveLegacyGuestRoomSessionGrant);
const mockReadPendingJoin = jest.mocked(readGuestRoomPendingJoin);
const mockReadPendingLeave = jest.mocked(readGuestRoomPendingLeave);
const mockSavePendingLeave = jest.mocked(saveGuestRoomPendingLeave);
const mockReadPendingRotation = jest.mocked(readGuestRoomPendingRotation);
const mockSavePendingRotation = jest.mocked(saveGuestRoomPendingRotation);
const mockCreateGuestToken = jest.mocked(createGuestRoomToken);
const mockCreateRotationId = jest.mocked(createGuestRoomRotationId);
const mockReadGuestRoomSessionGrant = jest.mocked(readGuestRoomSessionGrant);
const mockSaveGuestRoomSessionGrant = jest.mocked(saveGuestRoomSessionGrant);

const guestRoomRpcMock = {
  joinRoomAsGuest: (
    implementation?: GuestRoomRpcClient["joinRoomAsGuest"],
  ) => jest.fn<GuestRoomRpcClient["joinRoomAsGuest"]>(implementation),
  getGuestRoomSnapshot: (
    implementation?: GuestRoomRpcClient["getGuestRoomSnapshot"],
  ) => jest.fn<GuestRoomRpcClient["getGuestRoomSnapshot"]>(implementation),
  leaveRoomAsGuest: (
    implementation?: GuestRoomRpcClient["leaveRoomAsGuest"],
  ) => jest.fn<GuestRoomRpcClient["leaveRoomAsGuest"]>(implementation),
  rotateGuestRoomGrant: (
    implementation?: GuestRoomRpcClient["rotateGuestRoomGrant"],
  ) => jest.fn<GuestRoomRpcClient["rotateGuestRoomGrant"]>(implementation),
  setMyRoomPicksAsGuest: (
    implementation?: GuestRoomRpcClient["setMyRoomPicksAsGuest"],
  ) => jest.fn<GuestRoomRpcClient["setMyRoomPicksAsGuest"]>(implementation),
};

const createGuestRoomRpcClientMock = (
  overrides: Partial<GuestRoomRpcClient> = {},
): GuestRoomRpcClient => ({
  joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
  getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(),
  leaveRoomAsGuest: guestRoomRpcMock.leaveRoomAsGuest(),
  rotateGuestRoomGrant: guestRoomRpcMock.rotateGuestRoomGrant(),
  setMyRoomPicksAsGuest: guestRoomRpcMock.setMyRoomPicksAsGuest(),
  changeManualScoreAsGuest: jest.fn<GuestRoomRpcClient["changeManualScoreAsGuest"]>(),
  changeParticipantDrinkAsGuest: jest.fn<GuestRoomRpcClient["changeParticipantDrinkAsGuest"]>(),
  ...overrides,
});

const setGuestRoomRpcClient = (client: Partial<GuestRoomRpcClient>) =>
  mockGetGuestRoomRpcClient.mockReturnValue(createGuestRoomRpcClientMock(client));

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
    useGameStore.setState({ endedGuestSessionId: null });
    jest.clearAllMocks();
    mockReadLegacyGrant.mockResolvedValue(null);
    mockReadPendingJoin.mockResolvedValue(null);
    mockReadPendingLeave.mockResolvedValue(null);
    mockReadPendingRotation.mockResolvedValue(null);
    mockCreateGuestToken.mockResolvedValue("d".repeat(64));
    mockCreateRotationId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("distinguishes host termination on restore and discards a concurrent late snapshot", async () => {
    mockReadGuestRoomSessionGrant.mockResolvedValue(createGrant());
    let release!: (snapshot: GuestRoomSnapshot) => void;
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot()
      .mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
      .mockRejectedValueOnce(new Error("room_ended"));
    setGuestRoomRpcClient({ getGuestRoomSnapshot });
    let first!: UseGuestRoomSessionResult;
    let second!: UseGuestRoomSessionResult;
    const Probe = () => { first = useGuestRoomSession(); second = useGuestRoomSession(); return null; };
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); });
    expect(useGameStore.getState().endedGuestSessionId).toBe("session-1");
    expect(second.status).toBe("ended");
    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalledWith("session-1");
    await TestRenderer.act(async () => { release(createSnapshot()); });
    expect(first.status).toBe("ended");
    expect(first.session).toBeNull();
    expect(second.error).toBeNull();
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();
    TestRenderer.act(() => renderer.unmount());
  });

  it("keeps ordinary expiry separate from host termination", async () => {
    mockReadGuestRoomSessionGrant.mockResolvedValue(createGrant());
    setGuestRoomRpcClient({ getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot().mockRejectedValue(new Error("guest_access_lost")) });
    let observed!: UseGuestRoomSessionResult;
    const Probe = () => { observed = useGuestRoomSession(); return null; };
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); });
    expect(observed.status).toBe("expired");
    expect(useGameStore.getState().endedGuestSessionId).toBeNull();
    TestRenderer.act(() => renderer.unmount());
  });

  it("restores a persisted guest grant into a joined session", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
    });

    let observedHook!: UseGuestRoomSessionResult;

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

  it("removes legacy plaintext before validation and only transfers a validated grant", async () => {
    const legacyGrant = createGrant();
    mockReadLegacyGrant.mockResolvedValueOnce(legacyGrant);
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());
    setGuestRoomRpcClient({ joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    expect(mockReadLegacyGrant).toHaveBeenCalledTimes(1);
    expect(getGuestRoomSnapshot).toHaveBeenCalledWith(legacyGrant.guestToken);
    expect(mockReadLegacyGrant.mock.invocationCallOrder[0]).toBeLessThan(getGuestRoomSnapshot.mock.invocationCallOrder[0]);
    expect(mockSaveGuestRoomSessionGrant).toHaveBeenCalledWith(legacyGrant);
    expect(observedHook?.status).toBe("joined");
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("does not re-persist a legacy bearer when offline validation fails", async () => {
    mockReadLegacyGrant.mockResolvedValueOnce(createGrant());
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(async () => { throw new Error("offline"); }),
    });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(observedHook?.session).toBeNull();
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("retries a protected pending join after remount with the exact same token", async () => {
    mockReadPendingJoin.mockResolvedValueOnce({
      kind: "pending_join", token: "retry-token", joinCode: "ROOM42", displayName: "Casey",
    });
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest(async () => ({
      guestToken: "retry-token", participantId: "guest-1", sessionId: "session-1",
      joinCode: "ROOM42", displayName: "Casey", grantExpiresAt: "2026-09-22T00:00:00Z",
      snapshot: createSnapshot(),
    }));
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot();
    setGuestRoomRpcClient({ joinRoomAsGuest, getGuestRoomSnapshot });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    expect(joinRoomAsGuest).toHaveBeenCalledWith({ joinCode: "ROOM42", guestName: "Casey", guestToken: "retry-token" });
    expect(getGuestRoomSnapshot).not.toHaveBeenCalled();
    expect(mockSaveGuestRoomSessionGrant).toHaveBeenCalledWith(expect.objectContaining({
      guestToken: "retry-token", grantExpiresAt: "2026-09-22T00:00:00Z",
    }));
    expect(observedHook?.status).toBe("joined");
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("refreshes the current room snapshot without rewriting the protected grant every second", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = guestRoomRpcMock
      .getGuestRoomSnapshot()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot({ state: "in_progress" }));

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
    });

    let observedHook!: UseGuestRoomSessionResult;

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
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(observedHook?.session?.snapshot.state).toBe("in_progress");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("polls the joined room snapshot so host gameplay transitions appear without rejoining", async () => {
    jest.useFakeTimers();

    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = guestRoomRpcMock
      .getGuestRoomSnapshot()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot({ state: "in_progress" }));

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
    });

    let observedHook!: UseGuestRoomSessionResult;

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
    expect(observedHook?.session?.snapshot.state).toBe("in_progress");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("clears the persisted grant and marks the session expired when the server rejects it as expired", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => {
      throw new Error("guest_token_expired");
    });

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
    });

    let observedHook!: UseGuestRoomSessionResult;

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
    const getGuestRoomSnapshot = guestRoomRpcMock
      .getGuestRoomSnapshot()
      .mockResolvedValueOnce(createSnapshot())
      .mockRejectedValueOnce(new Error("network down"));

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
    });

    let observedHook!: UseGuestRoomSessionResult;

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
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
      leaveRoomAsGuest: guestRoomRpcMock.leaveRoomAsGuest(async () => ({ ok: true, status: "confirmed" as const })),
    });

    let observedHook!: UseGuestRoomSessionResult;

    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(observedHook?.leaveRoom()).resolves.toBe(true);
    });

    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalled();
    expect(mockSavePendingLeave).toHaveBeenCalledWith(persistedGrant);
    expect(observedHook?.status).toBe("left");
    expect(observedHook?.session).toBeNull();
    expect(observedHook?.error).toBeNull();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("stores a confirmed in-game guest result before clearing the grant", async () => {
    const grant = createGrant();
    const leftAt = "2026-09-28T12:00:00Z";
    useGameStore.setState({ history: [] });
    mockReadGuestRoomSessionGrant.mockResolvedValue(grant);
    const snapshot = createSnapshot({ state: "in_progress",
      participants: createSnapshot().participants.map((p) => p.id === "guest-1"
        ? { ...p, currentDrinkTotal: 3, leftAt } : p),
    });
    setGuestRoomRpcClient({
      getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(async () => snapshot),
      leaveRoomAsGuest: guestRoomRpcMock.leaveRoomAsGuest(async () => ({
        ok: true, status: "confirmed" as const, leftAt,
        result: snapshot,
      })),
    });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    await TestRenderer.act(async () => {
      await expect(observedHook.leaveRoom()).resolves.toBe(true);
    });
    expect(useGameStore.getState().history).toMatchObject([{
      id: grant.sessionId, isEarlyLeaveResult: true,
      players: [{}, { id: "guest-1", drinksTaken: 3, leftAt }],
    }]);
    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalled();
    TestRenderer.act(() => renderer.unmount());
  });

  it("keeps the grant and reports an unconfirmed in-progress departure", async () => {
    const persistedGrant = createGrant();
    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot()),
      leaveRoomAsGuest: guestRoomRpcMock.leaveRoomAsGuest(async () => ({
        ok: false,
        code: "not_permitted" as const,
      })),
    });

    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => {
      observedHook = useGuestRoomSession();
      return null;
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(Probe));
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(observedHook.leaveRoom()).resolves.toBe(false);
    });

    expect(mockClearGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(observedHook.status).toBe("joined");
    expect(observedHook.session?.grant).toEqual(persistedGrant);
    expect(observedHook.error).toBe("Could not confirm departure. Your guest access remains active.");
    await TestRenderer.act(async () => renderer!.unmount());
  });

  it("keeps departure pending and retains protected access when the leave response is lost", async () => {
    const persistedGrant = createGrant();
    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot()),
      leaveRoomAsGuest: guestRoomRpcMock.leaveRoomAsGuest(async () => { throw new Error("offline"); }),
    });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    await TestRenderer.act(async () => { await expect(observedHook?.leaveRoom()).resolves.toBe(false); });
    expect(mockSavePendingLeave).toHaveBeenCalledWith(persistedGrant);
    expect(mockClearGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(observedHook?.session).toBeNull();
    expect(observedHook?.status).toBe("pending_leave");
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("stages a replacement before renewal and polls only with the confirmed new token", async () => {
    const grant = createGrant({ grantExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
    mockReadPendingRotation
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        kind: "pending_rotation", token: grant.guestToken, replacementToken: "d".repeat(64),
        operationId: "00000000-0000-4000-8000-000000000001",
        participantId: grant.participantId, sessionId: grant.sessionId,
        joinCode: grant.joinCode, displayName: grant.displayName, grantExpiresAt: grant.grantExpiresAt!,
      });
    mockReadGuestRoomSessionGrant.mockResolvedValue(grant);
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());
    const rotateGuestRoomGrant = guestRoomRpcMock.rotateGuestRoomGrant(async () => ({
      ok: true as const, participantId: grant.participantId,
      grantExpiresAt: new Date(Date.now() + 48 * 60 * 60_000).toISOString(), replayed: false,
    }));
    setGuestRoomRpcClient({ joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot, rotateGuestRoomGrant });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    await TestRenderer.act(async () => { await observedHook?.refreshRoom(); });
    expect(mockSavePendingRotation).toHaveBeenCalledWith(grant, "d".repeat(64), "00000000-0000-4000-8000-000000000001");
    expect(mockSavePendingRotation.mock.invocationCallOrder[0]).toBeLessThan(rotateGuestRoomGrant.mock.invocationCallOrder[0]);
    expect(rotateGuestRoomGrant).toHaveBeenCalledWith(grant.guestToken, "d".repeat(64), "00000000-0000-4000-8000-000000000001");
    expect(getGuestRoomSnapshot.mock.calls.at(-1)?.[0]).toBe("d".repeat(64));
    expect(observedHook?.session?.grant.guestToken).toBe("d".repeat(64));
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("does not poll the old token after an uncertain renewal response", async () => {
    const grant = createGrant({ grantExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
    mockReadPendingRotation
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        kind: "pending_rotation", token: grant.guestToken, replacementToken: "d".repeat(64),
        operationId: "00000000-0000-4000-8000-000000000001",
        participantId: grant.participantId, sessionId: grant.sessionId,
        joinCode: grant.joinCode, displayName: grant.displayName, grantExpiresAt: grant.grantExpiresAt!,
      });
    mockReadGuestRoomSessionGrant.mockResolvedValue(grant);
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());
    const rotateGuestRoomGrant = guestRoomRpcMock.rotateGuestRoomGrant(async () => { throw new Error("offline"); });
    setGuestRoomRpcClient({ joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot, rotateGuestRoomGrant });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    await TestRenderer.act(async () => { await observedHook?.refreshRoom(); });
    expect(mockSavePendingRotation).toHaveBeenCalled();
    expect(getGuestRoomSnapshot).toHaveBeenCalledTimes(1);
    expect(observedHook?.session).toBeNull();
    expect(observedHook?.status).toBe("renewing");
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("recognizes termination of the replacement grant after a lost rotation response", async () => {
    const grant = createGrant({ grantExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
    const replacementToken = "d".repeat(64);
    // The successful rotation response was lost, leaving this durable operation.
    mockReadPendingRotation.mockResolvedValueOnce({
      kind: "pending_rotation", token: grant.guestToken, replacementToken,
      operationId: "00000000-0000-4000-8000-000000000001",
      participantId: grant.participantId, sessionId: grant.sessionId,
      joinCode: grant.joinCode, displayName: grant.displayName, grantExpiresAt: grant.grantExpiresAt!,
    });
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
    const rotateGuestRoomGrant = guestRoomRpcMock.rotateGuestRoomGrant(async () => ({ ok: false as const, code: "guest_access_lost" as const }));
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async (token) => {
      throw new Error(token === replacementToken ? "room_ended" : "guest_access_lost");
    });
    setGuestRoomRpcClient({ rotateGuestRoomGrant, getGuestRoomSnapshot });
    let observed!: UseGuestRoomSessionResult;
    function Probe() {
      const value = useGuestRoomSession();
      React.useEffect(() => { observed = value; }, [value]);
      return null;
    }
    let renderer!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); });
    expect(getGuestRoomSnapshot).toHaveBeenCalledWith(replacementToken);
    expect(observed.status).toBe("ended");
    expect(observed.session).toBeNull();
    expect(observed.error).toBeNull();
    expect(useGameStore.getState().endedGuestSessionId).toBe("session-1");
    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalledWith("session-1");
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();
    TestRenderer.act(() => renderer.unmount());
  });

  it("retries an exact pending rotation after restart before any snapshot", async () => {
    const grant = createGrant({ grantExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
    mockReadPendingRotation.mockResolvedValueOnce({
      kind: "pending_rotation", token: grant.guestToken, replacementToken: "d".repeat(64),
      operationId: "00000000-0000-4000-8000-000000000001",
      participantId: grant.participantId, sessionId: grant.sessionId,
      joinCode: grant.joinCode, displayName: grant.displayName, grantExpiresAt: grant.grantExpiresAt!,
    });
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());
    const rotateGuestRoomGrant = guestRoomRpcMock.rotateGuestRoomGrant(async () => ({
      ok: true as const, participantId: grant.participantId,
      grantExpiresAt: new Date(Date.now() + 48 * 60 * 60_000).toISOString(), replayed: true,
    }));
    setGuestRoomRpcClient({ joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot, rotateGuestRoomGrant });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    expect(rotateGuestRoomGrant).toHaveBeenCalledWith(grant.guestToken, "d".repeat(64), "00000000-0000-4000-8000-000000000001");
    expect(getGuestRoomSnapshot).toHaveBeenCalledWith("d".repeat(64));
    expect(getGuestRoomSnapshot).not.toHaveBeenCalledWith(grant.guestToken);
    expect(observedHook?.session?.grant.guestToken).toBe("d".repeat(64));
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("retries a protected pending leave after restart without showing room data", async () => {
    const grant = createGrant();
    mockReadPendingLeave.mockResolvedValueOnce(grant);
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
    const leaveRoomAsGuest = guestRoomRpcMock.leaveRoomAsGuest(async () => ({ ok: true as const, status: "confirmed" as const }));
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot();
    setGuestRoomRpcClient({ joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(), getGuestRoomSnapshot, leaveRoomAsGuest });
    let observedHook!: UseGuestRoomSessionResult;
    const Probe = () => { observedHook = useGuestRoomSession(); return null; };
    const renderer = TestRenderer.create(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    expect(leaveRoomAsGuest).toHaveBeenCalledWith(grant.guestToken);
    expect(getGuestRoomSnapshot).not.toHaveBeenCalled();
    expect(mockClearGuestRoomSessionGrant).toHaveBeenCalled();
    expect(observedHook?.session).toBeNull();
    expect(observedHook?.status).toBe("left");
    TestRenderer.act(() => { renderer.unmount(); });
  });
  it("submits a guest's own picks by room-scoped token and refreshes (T029)", async () => {
    const persistedGrant = createGrant();
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());
    const setMyRoomPicksAsGuest = guestRoomRpcMock.setMyRoomPicksAsGuest(async () => undefined);

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
      setMyRoomPicksAsGuest,
    });

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
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => {
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
    const setMyRoomPicksAsGuest = guestRoomRpcMock.setMyRoomPicksAsGuest(async () => undefined);

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
      setMyRoomPicksAsGuest,
    });

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
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot(async () => createSnapshot());
    const setMyRoomPicksAsGuest = guestRoomRpcMock.setMyRoomPicksAsGuest(async () => {
      throw new Error("pick_limit_exceeded");
    });

    mockReadGuestRoomSessionGrant.mockResolvedValue(persistedGrant);
    setGuestRoomRpcClient({
      joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
      getGuestRoomSnapshot,
      setMyRoomPicksAsGuest,
    });

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
