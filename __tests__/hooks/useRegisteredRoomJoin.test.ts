import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  useRegisteredRoomJoin,
  type UseRegisteredRoomJoinResult,
} from "../../hooks/useRegisteredRoomJoin";
import { getRoomRpcClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getRoomRpcClient: jest.fn(),
}));

const mockGetRoomRpcClient = jest.mocked(getRoomRpcClient);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const render = () => {
  let observed: UseRegisteredRoomJoinResult | null = null;
  const Probe = () => {
    observed = useRegisteredRoomJoin();
    return null;
  };
  const renderer = TestRenderer.create(React.createElement(Probe));
  return { result: () => observed, renderer };
};

describe("useRegisteredRoomJoin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the join response on success", async () => {
    const joinRoomAsRegistered = jest.fn(async () => ({
      participantId: "p1",
      sessionId: "s1",
      joinCode: "123456",
      displayName: "Sam",
      membershipType: "registered" as const,
      sessionRole: "member" as const,
      snapshot: {} as never,
    }));
    mockGetRoomRpcClient.mockReturnValue({ joinRoomAsRegistered } as never);

    const { result, renderer } = render();
    let response: unknown;
    await TestRenderer.act(async () => {
      response = await result()?.joinRoom("123456");
      await flush();
    });
    expect(joinRoomAsRegistered).toHaveBeenCalledWith("123456");
    expect((response as { sessionId: string }).sessionId).toBe("s1");
    expect(result()?.error).toBeNull();
    renderer.unmount();
  });

  it("surfaces the conflicting room on already_in_active_room", async () => {
    const joinRoomAsRegistered = jest.fn(async () => {
      throw new Error("already_in_active_room");
    });
    const getMyActiveRoom = jest.fn(async () => ({
      sessionId: "current-1",
      role: "owner" as const,
      joinCode: "999999",
    }));
    mockGetRoomRpcClient.mockReturnValue({
      joinRoomAsRegistered,
      getMyActiveRoom,
    } as never);

    const { result, renderer } = render();
    await TestRenderer.act(async () => {
      await result()?.joinRoom("123456");
      await flush();
    });
    expect(result()?.conflictRoom?.sessionId).toBe("current-1");
    expect(result()?.error).toBeNull();
    renderer.unmount();
  });

  it("maps room_not_found to friendly copy", async () => {
    const joinRoomAsRegistered = jest.fn(async () => {
      throw new Error("room_not_found");
    });
    mockGetRoomRpcClient.mockReturnValue({ joinRoomAsRegistered } as never);

    const { result, renderer } = render();
    await TestRenderer.act(async () => {
      await result()?.joinRoom("000000");
      await flush();
    });
    expect(result()?.error).toBe(
      "We couldn't find that room. Check the code and try again.",
    );
    renderer.unmount();
  });
});
