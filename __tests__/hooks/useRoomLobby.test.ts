import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { useRoomLobby, type UseRoomLobbyResult } from "../../hooks/useRoomLobby";
import type { RoomSnapshot } from "../../types/room";
import { getRoomRpcClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getRoomRpcClient: jest.fn(),
  LOBBY_POLL_INTERVAL_MS: 4000,
}));

const mockGetRoomRpcClient = jest.mocked(getRoomRpcClient);

const snapshot = (overrides: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  sessionId: "session-1",
  joinCode: "123456",
  state: "joinable",
  commonMatchId: null,
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
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderLobby = async (
  sessionId: string,
  participantId: string,
): Promise<{ result: () => UseRoomLobbyResult | null; unmount: () => void }> => {
  let observed: UseRoomLobbyResult | null = null;
  const Probe = () => {
    observed = useRoomLobby(sessionId, participantId);
    return null;
  };
  const renderer = TestRenderer.create(React.createElement(Probe));
  await TestRenderer.act(async () => {
    await flush();
  });
  return { result: () => observed, unmount: () => renderer.unmount() };
};

describe("useRoomLobby", () => {
  beforeEach(() => jest.clearAllMocks());

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

  it("flags the room as ended when the state is closed", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot({ state: "closed" })),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.roomEnded).toBe(true);
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

  it("flags gameStarted once the snapshot state transitions to in_progress (FR-012)", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot({ state: "joinable" })),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.gameStarted).toBe(false);
    unmount();
  });

  it("flags gameStarted true when the room is in_progress", async () => {
    mockGetRoomRpcClient.mockReturnValue({
      getRoomSnapshot: jest.fn(async () => snapshot({ state: "in_progress" })),
    } as never);

    const { result, unmount } = await renderLobby("session-1", "owner-1");
    expect(result()?.gameStarted).toBe(true);
    expect(result()?.roomEnded).toBe(false);
    unmount();
  });
});
