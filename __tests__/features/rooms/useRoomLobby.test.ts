import { renderHook } from "../../../test-utils/render";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import TestRenderer from "react-test-renderer";

import { useRoomLobby, type UseRoomLobbyResult } from "../../../features/rooms/useRoomLobby";
import type { RoomSnapshot } from "../../../types/room";
import { getRoomRpcClient } from "../../../features/rooms/roomRpcClient";

jest.mock("../../../features/rooms/roomRpcClient", () => ({
  getRoomRpcClient: jest.fn(),
  LOBBY_POLL_INTERVAL_MS: 4000,
}));

const mockGetRoomRpcClient = jest.mocked(getRoomRpcClient);

const snapshot = (overrides: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  sessionId: "session-1",
  joinCode: "123456",
  state: "joinable",
  commonMatchId: null,
  assignmentMode: "automatic",
  participants: [
    {
      id: "owner-1",
      displayName: "Host",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
    {
      id: "member-1",
      displayName: "Sam",
      membershipType: "registered",
      sessionRole: "member",
      currentDrinkTotal: 0,
    },
  ],
  matches: [],
  assignments: [],
  picks: [],
  assignmentPlan: {
    participantCount: 2,
    poolSize: 0,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: 3,
    relaxedFloor: 2,
    feasible: false,
    startable: false,
  },
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderLobby = async (
  sessionId: string,
  participantId: string,
): Promise<{ result: () => UseRoomLobbyResult | null; unmount: () => void }> => {
  const { renderer, getLatest } = renderHook(() => useRoomLobby(sessionId, participantId));
  await TestRenderer.act(async () => {
    await flush();
  });
  return { result: getLatest, unmount: () => TestRenderer.act(() => renderer.unmount()) };
};

describe("useRoomLobby", () => {
  it("shows only active roster members while retaining participants in the game projection", async () => {
    const full = snapshot();
    const getRoomSnapshot = jest.fn().mockResolvedValue({ ...full, activeRoster: full.participants.slice(0, 1) });
    mockGetRoomRpcClient.mockReturnValue({ getRoomSnapshot } as never);
    const lobby = await renderLobby("session-1", "owner-1");
    expect(lobby.result()?.participants.map(player => player.id)).toEqual(["owner-1"]);
    expect(lobby.result()?.snapshot?.participants).toHaveLength(2);
    lobby.unmount();
  });
  beforeEach(() => { jest.clearAllMocks(); });

  it("exposes the roster and the join code to the host", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot()),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.participants).toHaveLength(2);
    expect(result()?.myRole).toBe("owner");
    expect(result()?.joinCode).toBe("123456");
    unmount();
  });

  it("hides the join code from a member", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot()),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "member-1");
    expect(result()?.myRole).toBe("member");
    expect(result()?.joinCode).toBeNull();
    unmount();
  });

  it.each(["closed", "completed"] as const)("flags a %s room as ended", async (state) => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot({ state })),
    } as never);
    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.roomEnded).toBe(true);
    unmount();
  });

  it("does not flag a running game as ended", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot({ state: "in_progress" })),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.roomEnded).toBe(false);
    expect(result()?.gameStarted).toBe(true);
    unmount();
  });

  it("flags the room as ended when the viewer is no longer present", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot()),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "ghost-1");
    expect(result()?.roomEnded).toBe(true);
    unmount();
  });

  it("keeps a joinable room waiting for game start", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot({ state: "joinable" })),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.gameStarted).toBe(false);
    unmount();
  });


});
