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
  assignmentMode: "automatic",
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
  picks: [],
  assignmentPlan: {
    participantCount: 2,
    poolSize: 2,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: 3,
    relaxedFloor: 2,
    feasible: false,
    startable: true,
  },
};

const render = (snapshot: RoomSnapshot | null, onMutated?: () => void) => {
  let observed: UseRoomConfigureResult | null = null;
  const Probe = () => {
    observed = useRoomConfigure(snapshot, onMutated);
    return null;
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
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
    TestRenderer.act(() => {
      renderer.unmount();
    });
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
    TestRenderer.act(() => {
      renderer.unmount();
    });
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
    TestRenderer.act(() => {
      renderer.unmount();
    });
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
    TestRenderer.act(() => {
      renderer.unmount();
    });
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
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("sets the assignment settings", async () => {
    const setRoomAssignmentSettings = jest.fn(async () => undefined);
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignmentSettings } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setAssignmentSettings({
        matchesPerPlayer: 2,
        sharedMatchesPerPair: 1,
      });
      await flush();
    });

    expect(setRoomAssignmentSettings).toHaveBeenCalledWith("s1", {
      matchesPerPlayer: 2,
      sharedMatchesPerPair: 1,
    });
    expect(result()?.error).toBeNull();
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("maps per_player_count_below_minimum to a friendly, actionable message", async () => {
    const setRoomAssignmentSettings = jest.fn(async () => {
      throw new Error("per_player_count_below_minimum");
    });
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignmentSettings } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setAssignmentSettings({
        matchesPerPlayer: 0,
        sharedMatchesPerPair: 1,
      });
      await flush();
    });

    expect(result()?.error).toBe(
      "That per-player count is too low for the current shared-matches setting and roster size.",
    );
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("sets the assignment mode", async () => {
    const setRoomAssignmentMode = jest.fn(async () => undefined);
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignmentMode } as never);
    const onMutated = jest.fn();

    const { result, renderer } = render(baseSnapshot, onMutated);
    await TestRenderer.act(async () => {
      await result()?.setAssignmentMode("host_assigned");
      await flush();
    });

    expect(setRoomAssignmentMode).toHaveBeenCalledWith("s1", "host_assigned");
    expect(onMutated).toHaveBeenCalledTimes(1);
    expect(result()?.error).toBeNull();
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("maps invalid_assignment_mode to a friendly, actionable message", async () => {
    const setRoomAssignmentMode = jest.fn(async () => {
      throw new Error("invalid_assignment_mode");
    });
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignmentMode } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setAssignmentMode("automatic");
      await flush();
    });

    expect(result()?.error).toBe(
      "That isn't a valid assignment mode. Refresh and try again.",
    );
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("round-trips a host allocation through set_room_assignments when adding then removing a match for the same participant (T030)", async () => {
    const setRoomAssignments = jest.fn(async () => undefined);
    mockGetRoomRpcClient.mockReturnValue({ setRoomAssignments } as never);

    const { result, renderer } = render(baseSnapshot);
    await TestRenderer.act(async () => {
      await result()?.setAssignments([
        { participantId: "p-2", matchId: "match-2" },
      ]);
      await flush();
    });
    await TestRenderer.act(async () => {
      await result()?.setAssignments([]);
      await flush();
    });

    expect(setRoomAssignments).toHaveBeenNthCalledWith(1, "s1", [
      { participantId: "p-2", matchId: "match-2" },
    ]);
    expect(setRoomAssignments).toHaveBeenNthCalledWith(2, "s1", []);
    expect(result()?.error).toBeNull();
    TestRenderer.act(() => {
      renderer.unmount();
    });
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
    expect(startGame).toHaveBeenCalledWith("s1", "jwt-123", "fixed-idempotency-key", false);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("passes relaxConstraints=true through to the command API when the host overrides a shortfall", async () => {
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
      success = await result()?.startGame(true);
      await flush();
    });

    expect(success).toBe(true);
    expect(startGame).toHaveBeenCalledWith("s1", "jwt-123", "fixed-idempotency-key", true);
    TestRenderer.act(() => {
      renderer.unmount();
    });
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
    expect(startGame).toHaveBeenNthCalledWith(1, "s1", "jwt-123", "fixed-idempotency-key", false);
    expect(startGame).toHaveBeenNthCalledWith(2, "s1", "jwt-123", "fixed-idempotency-key", false);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
