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
    createGuestRoomToken: jest.fn(() => "guest-token-1"),
    readGuestRoomSessionGrant: jest.fn(async () => null),
    saveGuestRoomSessionGrant: jest.fn(async (grant) => grant),
    clearGuestRoomSessionGrant: jest.fn(async () => undefined),
  };
});

const mockGetGuestRoomRpcClient = jest.mocked(getGuestRoomRpcClient);
const mockCreateGuestRoomToken = jest.mocked(createGuestRoomToken);
const mockClearGuestRoomSessionGrant = jest.mocked(clearGuestRoomSessionGrant);
const mockReadGuestRoomSessionGrant = jest.mocked(readGuestRoomSessionGrant);
const mockSaveGuestRoomSessionGrant = jest.mocked(saveGuestRoomSessionGrant);

const createGuestRoomSnapshot = (
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
    mockReadGuestRoomSessionGrant.mockResolvedValue(null);
  });

  it("joins a room with normalized input, persists the grant, and uses the join response snapshot for the first render", async () => {
    const joinRoomAsGuest = jest.fn(async () => createGuestRoomJoinResponse());
    const getGuestRoomSnapshot = jest.fn();

    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest,
      getGuestRoomSnapshot,
    });

    let observedHook: UseGuestRoomJoinResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

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
    const joinRoomAsGuest = jest
      .fn()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce(
        createGuestRoomJoinResponse({ guestToken: "retry-token-1" }),
      );

    mockCreateGuestRoomToken
      .mockReturnValueOnce("retry-token-1")
      .mockReturnValueOnce("retry-token-2");

    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest,
      getGuestRoomSnapshot: jest.fn(),
    });

    let observedHook: UseGuestRoomJoinResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(
        observedHook?.submitGuestJoin("ROOM42", "Casey"),
      ).rejects.toThrow("transient failure");
    });

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

  it("rejects blank guest names before calling the guest join RPC", async () => {
    const joinRoomAsGuest = jest.fn();

    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest,
      getGuestRoomSnapshot: jest.fn(),
    });

    let observedHook: UseGuestRoomJoinResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

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
    const joinRoomAsGuest = jest.fn(async () => {
      throw new Error("room_not_found");
    });

    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest,
      getGuestRoomSnapshot: jest.fn(),
    });

    let observedHook: UseGuestRoomJoinResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(
        observedHook?.submitGuestJoin("ROOM42", "Casey"),
      ).rejects.toThrow("room_not_found");
    });

    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.error).toBe(
      "We couldn't find that room. Check the code and try again.",
    );
    expect(mockSaveGuestRoomSessionGrant).not.toHaveBeenCalled();
    expect(mockClearGuestRoomSessionGrant).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("maps closed-room join failures to clear user-facing copy", async () => {
    const joinRoomAsGuest = jest.fn(async () => {
      throw new Error("room_not_joinable");
    });

    mockGetGuestRoomRpcClient.mockReturnValue({
      joinRoomAsGuest,
      getGuestRoomSnapshot: jest.fn(),
    });

    let observedHook: UseGuestRoomJoinResult | null = null;

    const Probe = () => {
      observedHook = useGuestRoomJoin();
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe));

    await TestRenderer.act(async () => {
      await flushEffects();
    });

    await TestRenderer.act(async () => {
      await expect(
        observedHook?.submitGuestJoin("ROOM42", "Casey"),
      ).rejects.toThrow("room_not_joinable");
    });

    expect(observedHook?.status).toBe("failed");
    expect(observedHook?.error).toBe(
      "This room is no longer accepting guest joins.",
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
