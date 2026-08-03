import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { useRoomExit, type UseRoomExitResult } from "../../hooks/useRoomExit";
import type { RoomSnapshot } from "../../types/room";
import { getRoomRpcClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getRoomRpcClient: jest.fn(),
}));

const mockGetRoomRpcClient = jest.mocked(getRoomRpcClient);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const rosterWith = (memberIds: string[]): RoomSnapshot => ({
  sessionId: "s1",
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
    ...memberIds.map((id) => ({
      id,
      displayName: id,
      membershipType: "registered" as const,
      sessionRole: "member" as const,
      currentDrinkTotal: 0,
    })),
  ],
  matches: [],
  assignments: [],
  picks: [],
  assignmentPlan: {
    participantCount: memberIds.length + 1,
    poolSize: 0,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: memberIds.length + 2,
    relaxedFloor: 2,
    feasible: false,
    startable: false,
  },
});

const render = () => {
  let observed: UseRoomExitResult | null = null;
  const Probe = () => {
    observed = useRoomExit();
    return null;
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });
  return { result: () => observed, renderer };
};

describe("useRoomExit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("leaves directly as a member", async () => {
    const leaveRoomAsMember = jest.fn(async () => ({
      sessionId: "s1",
      status: "left" as const,
    }));
    mockGetRoomRpcClient.mockReturnValue({ leaveRoomAsMember } as never);

    const { result, renderer } = render();
    await TestRenderer.act(async () => {
      await result()?.exitRoom("s1", "member");
      await flush();
    });
    expect(leaveRoomAsMember).toHaveBeenCalledWith("s1");
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("auto-transfers as host when the server resolves it", async () => {
    const leaveRoomAsHost = jest.fn(async () => ({
      status: "transferred" as const,
      sessionId: "s1",
      newHostParticipantId: "member-1",
      newHostDisplayName: "Sam",
      snapshot: {} as never,
    }));
    mockGetRoomRpcClient.mockReturnValue({ leaveRoomAsHost } as never);

    const { result, renderer } = render();
    let response: unknown;
    await TestRenderer.act(async () => {
      response = await result()?.exitRoom("s1", "owner");
      await flush();
    });
    expect((response as { status: string }).status).toBe("transferred");
    expect(result()?.pendingSuccessorChoice).toBe(false);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("prompts for a successor when several are eligible", async () => {
    const leaveRoomAsHost = jest.fn(async () => {
      throw new Error("successor_required");
    });
    const getRoomSnapshot = jest.fn(async () =>
      rosterWith(["member-1", "member-2"]),
    );
    mockGetRoomRpcClient.mockReturnValue({
      leaveRoomAsHost,
      getRoomSnapshot,
    } as never);

    const { result, renderer } = render();
    await TestRenderer.act(async () => {
      await result()?.exitRoom("s1", "owner");
      await flush();
    });
    expect(result()?.pendingSuccessorChoice).toBe(true);
    expect(result()?.eligibleSuccessors).toHaveLength(2);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("falls through to a close confirmation when everyone left mid-choice", async () => {
    const leaveRoomAsHost = jest.fn(async () => {
      throw new Error("successor_not_eligible");
    });
    const getRoomSnapshot = jest.fn(async () => rosterWith([]));
    mockGetRoomRpcClient.mockReturnValue({
      leaveRoomAsHost,
      getRoomSnapshot,
    } as never);

    const { result, renderer } = render();
    await TestRenderer.act(async () => {
      await result()?.confirmSuccessor("s1", "gone-1");
      await flush();
    });
    expect(result()?.needsCloseConfirm).toBe(true);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
