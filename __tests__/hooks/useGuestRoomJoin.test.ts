import { actCreate } from "../../test-utils/render";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  useGuestRoomJoin,
  type UseGuestRoomJoinResult,
} from "../../hooks/useGuestRoomJoin";
import type {
  GuestRoomJoinResponse,
  GuestRoomSnapshot,
} from "../../types/guestRoom";
import {
  clearGuestRoomSessionGrant,
  createGuestRoomToken,
  readGuestRoomPendingJoin,
  saveGuestRoomPendingJoin,
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
    createGuestRoomToken: jest.fn(async () => "guest-token-1"),
    readAndRemoveLegacyGuestRoomSessionGrant: jest.fn(async () => null),
    readGuestRoomPendingJoin: jest.fn(async () => null),
    saveGuestRoomPendingJoin: jest.fn(async () => undefined),
    readGuestRoomSessionGrant: jest.fn(async () => null),
    saveGuestRoomSessionGrant: jest.fn(async (grant) => grant),
    clearGuestRoomSessionGrant: jest.fn(async () => undefined),
  };
});

const mockGetGuestRoomRpcClient = jest.mocked(getGuestRoomRpcClient);
const mockCreateGuestRoomToken = jest.mocked(createGuestRoomToken);
const mockSaveGuestRoomPendingJoin = jest.mocked(saveGuestRoomPendingJoin);
const mockReadGuestRoomPendingJoin = jest.mocked(readGuestRoomPendingJoin);
const mockClearGuestRoomSessionGrant = jest.mocked(clearGuestRoomSessionGrant);
const mockReadGuestRoomSessionGrant = jest.mocked(readGuestRoomSessionGrant);
const mockSaveGuestRoomSessionGrant = jest.mocked(saveGuestRoomSessionGrant);

const guestRoomRpcMock = {
  joinRoomAsGuest: (
    implementation?: GuestRoomRpcClient["joinRoomAsGuest"],
  ) => jest.fn<GuestRoomRpcClient["joinRoomAsGuest"]>(implementation),
  getGuestRoomSnapshot: (
    implementation?: GuestRoomRpcClient["getGuestRoomSnapshot"],
  ) => jest.fn<GuestRoomRpcClient["getGuestRoomSnapshot"]>(implementation),
};

const createGuestRoomRpcClientMock = (
  overrides: Partial<GuestRoomRpcClient> = {},
): GuestRoomRpcClient => ({
  joinRoomAsGuest: guestRoomRpcMock.joinRoomAsGuest(),
  getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(),
  leaveRoomAsGuest: jest.fn<GuestRoomRpcClient["leaveRoomAsGuest"]>(),
  rotateGuestRoomGrant: jest.fn<GuestRoomRpcClient["rotateGuestRoomGrant"]>(),
  setMyRoomPicksAsGuest: jest.fn<GuestRoomRpcClient["setMyRoomPicksAsGuest"]>(),
  changeManualScoreAsGuest: jest.fn<GuestRoomRpcClient["changeManualScoreAsGuest"]>(),
  changeParticipantDrinkAsGuest: jest.fn<GuestRoomRpcClient["changeParticipantDrinkAsGuest"]>(),
  ...overrides,
});

const setGuestRoomRpcClient = (client: Partial<GuestRoomRpcClient>) =>
  mockGetGuestRoomRpcClient.mockReturnValue(createGuestRoomRpcClientMock(client));

const createGuestRoomSnapshot = (
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
  matches: [
    {
      id: "match-1",
      sourceProvider: "espn",
      sourceMatchId: "espn-1",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      kickoffAt: "2026-05-15T18:00:00.000Z",
      homeScore: 1,
      awayScore: 0,
    },
  ],
  assignments: [
    {
      participantId: "owner-1",
      matchId: "match-1",
    },
  ],
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

const createGuestRoomJoinResponse = (
  overrides: Partial<GuestRoomJoinResponse> = {},
): GuestRoomJoinResponse => ({
  participantId: "guest-1",
  sessionId: "session-1",
  guestToken: "guest-token-1",
  joinCode: "ROOM42",
  displayName: "Casey",
  snapshot: createGuestRoomSnapshot(),
  ...overrides,
});

const flushEffects = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("useGuestRoomJoin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGuestRoomToken.mockReset();
    mockCreateGuestRoomToken.mockResolvedValue("guest-token-1");
    mockSaveGuestRoomPendingJoin.mockReset();
    mockSaveGuestRoomPendingJoin.mockResolvedValue(undefined);
    mockReadGuestRoomPendingJoin.mockReset();
    mockReadGuestRoomPendingJoin.mockResolvedValue(null);
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
  });

  it("joins a room with normalized input, persists the grant, and uses the join response snapshot for the first render", async () => {
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest(async () => createGuestRoomJoinResponse());
    const getGuestRoomSnapshot = guestRoomRpcMock.getGuestRoomSnapshot();

    setGuestRoomRpcClient({
      joinRoomAsGuest,
      getGuestRoomSnapshot,
    });

    let observedHook!: UseGuestRoomJoinResult;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = actCreate(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await observedHook?.submitGuestJoin(" room42 ", "  Casey  ");
    });

    expect(joinRoomAsGuest).toHaveBeenCalledWith({
      joinCode: "ROOM42",
      guestName: "Casey",
      guestToken: "guest-token-1",
    });
    expect(getGuestRoomSnapshot).not.toHaveBeenCalled();
    expect(mockSaveGuestRoomSessionGrant).toHaveBeenCalledWith({
      guestToken: "guest-token-1",
      participantId: "guest-1",
      sessionId: "session-1",
      joinCode: "ROOM42",
      displayName: "Casey",
    });
    expect(observedHook?.status).toBe("joined");
    expect(observedHook?.session?.snapshot.joinCode).toBe("ROOM42");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("reuses the same guest token across retries until the join succeeds", async () => {
    mockReadGuestRoomPendingJoin
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ kind: "pending_join", token: "retry-token-1", joinCode: "ROOM42", displayName: "Casey" });
    const joinRoomAsGuest = guestRoomRpcMock
      .joinRoomAsGuest()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce(
        createGuestRoomJoinResponse({ guestToken: "retry-token-1" }),
      );

    mockCreateGuestRoomToken
      .mockResolvedValueOnce("retry-token-1")
      .mockResolvedValueOnce("retry-token-2");

    setGuestRoomRpcClient({
      joinRoomAsGuest,
      getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(),
    });

    let observedHook!: UseGuestRoomJoinResult;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = actCreate(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(
        observedHook?.submitGuestJoin("ROOM42", "Casey"),
      ).resolves.toBeNull();
    });

    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.isSubmitting).toBe(false);
    expect(observedHook?.session).toBeNull();
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();

    await TestRenderer.act(async () => {
      await observedHook?.submitGuestJoin("ROOM42", "Casey");
    });

    expect(joinRoomAsGuest).toHaveBeenNthCalledWith(1, {
      joinCode: "ROOM42",
      guestName: "Casey",
      guestToken: "retry-token-1",
    });
    expect(joinRoomAsGuest).toHaveBeenNthCalledWith(2, {
      joinCode: "ROOM42",
      guestName: "Casey",
      guestToken: "retry-token-1",
    });
    expect(mockCreateGuestRoomToken).toHaveBeenCalledTimes(1);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("does not send a join RPC when secure randomness is unavailable", async () => {
    mockCreateGuestRoomToken.mockRejectedValueOnce(new Error("secure_random_unavailable"));
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest();
    setGuestRoomRpcClient({ joinRoomAsGuest, getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot() });
    let observedHook!: UseGuestRoomJoinResult;
    const Probe = () => { observedHook = useGuestRoomJoin(); return null; };
    const renderer = actCreate(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    await TestRenderer.act(async () => { await observedHook?.submitGuestJoin("ROOM42", "Casey"); });
    expect(joinRoomAsGuest).not.toHaveBeenCalled();
    expect(mockSaveGuestRoomPendingJoin).not.toHaveBeenCalled();
    expect(observedHook?.error).toBe("Secure guest access is unavailable on this device. Please try again later.");
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("does not send a join RPC when protected pending storage fails", async () => {
    mockSaveGuestRoomPendingJoin.mockRejectedValueOnce(new Error("protected_storage_unavailable"));
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest();
    setGuestRoomRpcClient({ joinRoomAsGuest, getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot() });
    let observedHook!: UseGuestRoomJoinResult;
    const Probe = () => { observedHook = useGuestRoomJoin(); return null; };
    const renderer = actCreate(React.createElement(Probe));
    await TestRenderer.act(async () => { await flushEffects(); });
    await TestRenderer.act(async () => { await observedHook?.submitGuestJoin("ROOM42", "Casey"); });
    expect(joinRoomAsGuest).not.toHaveBeenCalled();
    TestRenderer.act(() => { renderer.unmount(); });
  });

  it("handles blank guest names before calling the guest join RPC", async () => {
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest();

    setGuestRoomRpcClient({
      joinRoomAsGuest,
      getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(),
    });

    let observedHook!: UseGuestRoomJoinResult;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = actCreate(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await observedHook?.submitGuestJoin("ROOM42", "   ");
    });

    expect(joinRoomAsGuest).not.toHaveBeenCalled();
    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.error).toBe("Enter a guest name to join the room.");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("maps room-not-found join failures to clear user-facing copy", async () => {
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest(async () => {
      throw new Error("room_not_found");
    });

    setGuestRoomRpcClient({
      joinRoomAsGuest,
      getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(),
    });

    let observedHook!: UseGuestRoomJoinResult;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = actCreate(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(
        observedHook?.submitGuestJoin("ROOM42", "Casey"),
      ).resolves.toBeNull();
    });

    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.error).toBe(
      "We couldn't find that room. Check the code and try again.",
    );
    expect(observedHook?.isSubmitting).toBe(false);
    expect(observedHook?.session).toBeNull();
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(mockClearGuestRoomSessionGrant).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("maps closed-room join failures to clear user-facing copy", async () => {
    const joinRoomAsGuest = guestRoomRpcMock.joinRoomAsGuest(async () => {
      throw new Error("room_not_joinable");
    });

    setGuestRoomRpcClient({
      joinRoomAsGuest,
      getGuestRoomSnapshot: guestRoomRpcMock.getGuestRoomSnapshot(),
    });

    let observedHook!: UseGuestRoomJoinResult;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = actCreate(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(
        observedHook?.submitGuestJoin("ROOM42", "Casey"),
      ).resolves.toBeNull();
    });

    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.error).toBe(
      "This room is no longer accepting guest joins.",
    );
    expect(observedHook?.isSubmitting).toBe(false);
    expect(observedHook?.session).toBeNull();
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
