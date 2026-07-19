import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  useRoomConfigure,
  type UseRoomConfigureResult,
} from "../../hooks/useRoomConfigure";
import type { RoomSnapshot } from "../../types/room";
import { generateIdempotencyKey, getStartGameApiClient } from "../../utils/commandApiClient";
import { getRoomRpcClient, getSupabaseClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getRoomRpcClient: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../utils/commandApiClient", () => ({
  generateIdempotencyKey: jest.fn(() => "fixed-idempotency-key"),
  getStartGameApiClient: jest.fn(),
}));

const mockGetRoomRpcClient = jest.mocked(getRoomRpcClient);
const mockGetSupabaseClient = jest.mocked(getSupabaseClient);
const mockGetStartGameApiClient = jest.mocked(getStartGameApiClient);
const mockGenerateIdempotencyKey = jest.mocked(generateIdempotencyKey);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const baseSnapshot: RoomSnapshot = {
  sessionId: "s1",
  joinCode: "123456",
  state: "joinable",
  commonMatchId: "match-1",
  participants: [
    {
      id: "p-1",
      displayName: "Host",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
    {
      id: "p-2",
      displayName: "Member",
      membershipType: "registered",
      sessionRole: "member",
      currentDrinkTotal: 0,
    },
  ],
  matches: [
    {
      id: "match-1",
      sourceProvider: "espn",
      sourceMatchId: "e-1",
      homeTeamName: "A",
      awayTeamName: "B",
      kickoffAt: null,
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: "match-2",
      sourceProvider: "espn",
      sourceMatchId: "e-2",
      homeTeamName: "C",
      awayTeamName: "D",
      kickoffAt: null,
      homeScore: 0,
      awayScore: 0,
    },
  ],
  assignments: [],
};

const render = (snapshot: RoomSnapshot | null, onMutated?: () => void) => {
  let observed: UseRoomConfigureResult | null = null;
  const Probe = () => {
    observed = useRoomConfigure(snapshot, onMutated);
    return null;
  };
  const renderer = TestRenderer.create(React.createElement(Probe));
  return { result: () => observed, renderer };
};

describe("useRoomConfigure", () => {
  beforeEach(() => jest.clearAllMocks());

  it("adds a match and triggers onMutated", async () => {
    const addRoomMatch = jest.fn(async () => "match-3");
    mockGetRoomRpcClient.mockReturnValue({ addRoomMatch } as never);
    const onMutated = jest.fn();

    const { result, renderer } = render(baseSnapshot, onMutated);
    await TestRenderer.act(async () => {
      await result()?.addMatch({
        sourceProvider: "espn",
        sourceMatchId: "e-3",
        homeTeamName: "E",
        awayTeamName: "F",
        kickoffAt: null,
      });
      await flush();
    });

    expect(addRoomMatch).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ sourceProvider: "espn" }),
    );
    expect(onMutated).toHaveBeenCalledTimes(1);
    expect(result()?.error).toBeNull();
    renderer.unmount();
  });

  it("surfaces a friendly error when removing a match fails", async () => {
    const removeRoomMatch = jest.fn(async () => {
      throw new Error("not_host");
    });
    mockGetRoomRpcClient.mockReturnValue({ removeRoomMatch } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.removeMatch("match-1");
      await flush();
    });

    expect(result()?.error).toBe("not_host");
    renderer.unmount();
  });

  it("maps match_not_found to a friendly, actionable message", async () => {
    const setCommonMatch = jest.fn(async () => {
      throw new Error("match_not_found");
    });
    mockGetRoomRpcClient.mockReturnValue({ setCommonMatch } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setCommonMatch("match-1");
      await flush();
    });

    expect(result()?.error).toBe(
      "That match is no longer in the room. Refresh and try again.",
    );
    renderer.unmount();
  });

  it("maps invalid_assignment to a friendly, actionable message", async () => {
    const setRoomAssignments = jest.fn(async () => {
      throw new Error("invalid_assignment");
    });
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignments } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setAssignments([
        { participantId: "p-1", matchId: "match-2" },
      ]);
      await flush();
    });

    expect(result()?.error).toBe(
      "One of those assignments referenced a participant or match that's no longer in the room.",
    );
    renderer.unmount();
  });

  it("sets the common match", async () => {
    const setCommonMatch = jest.fn(async () => undefined);
    mockGetRoomRpcClient.mockReturnValue({ setCommonMatch } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setCommonMatch("match-2");
      await flush();
    });

    expect(setCommonMatch).toHaveBeenCalledWith("s1", "match-2");
    renderer.unmount();
  });

  it("randomizes assignments across the pool, excluding the Common Match", async () => {
    const setRoomAssignments = jest.fn(
      async (_sessionId: string, _assignments: { participantId: string; matchId: string }[]) =>
        undefined,
    );
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignments } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.randomizeAssignments();
      await flush();
    });

    expect(setRoomAssignments).toHaveBeenCalledTimes(1);
    const [, assignments] = setRoomAssignments.mock.calls[0] as [string, { participantId: string; matchId: string }[]];
    expect(assignments).toHaveLength(2);
    assignments.forEach((assignment) => {
      expect(assignment.matchId).toBe("match-2"); // the only non-common match available
    });
    renderer.unmount();
  });

  it("does not call the RPC when there is no assignable match besides the common one", async () => {
    const setRoomAssignments = jest.fn(async () => undefined);
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignments } as never);
    const singleMatchSnapshot: RoomSnapshot = {
      ...baseSnapshot,
      matches: [baseSnapshot.matches[0] as RoomSnapshot["matches"][number]],
    };

    const { result, renderer } = render(singleMatchSnapshot);
    await TestRenderer.act(async () => {
      await result()?.randomizeAssignments();
      await flush();
    });

    expect(setRoomAssignments).not.toHaveBeenCalled();
    expect(result()?.error).toContain("Common Match");
    renderer.unmount();
  });

  it("dispatches start-game with a bearer token and a generated idempotency key", async () => {
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: "jwt-123" } },
          error: null,
        })),
      },
    } as never);
    const startGame = jest.fn(async () => ({
      commandType: "start-game",
      roomId: "s1",
      idempotencyKey: "fixed-idempotency-key",
      status: "ACCEPTED",
      timestamp: "2026-01-01T00:00:00.000Z",
    }));
    mockGetStartGameApiClient.mockReturnValue({ startGame } as never);

    const { result, renderer } = render(baseSnapshot);
    let success: boolean | undefined;
    await TestRenderer.act(async () => {
      success = await result()?.startGame();
      await flush();
    });

    expect(success).toBe(true);
    expect(mockGenerateIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(startGame).toHaveBeenCalledWith("s1", "jwt-123", "fixed-idempotency-key");
    renderer.unmount();
  });

  it("reuses the same idempotency key across a retry of the same attempt", async () => {
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: "jwt-123" } },
          error: null,
        })),
      },
    } as never);
    const startGame = jest
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("Start game request timed out.");
      })
      .mockImplementationOnce(async () => ({
        commandType: "start-game",
        roomId: "s1",
        idempotencyKey: "fixed-idempotency-key",
        status: "ACCEPTED",
        timestamp: "2026-01-01T00:00:00.000Z",
      }));
    mockGetStartGameApiClient.mockReturnValue({ startGame } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.startGame();
      await flush();
    });
    expect(result()?.error).toContain("timed out");

    await TestRenderer.act(async () => {
      await result()?.startGame();
      await flush();
    });

    expect(mockGenerateIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(startGame).toHaveBeenNthCalledWith(1, "s1", "jwt-123", "fixed-idempotency-key");
    expect(startGame).toHaveBeenNthCalledWith(2, "s1", "jwt-123", "fixed-idempotency-key");
    renderer.unmount();
  });
});
