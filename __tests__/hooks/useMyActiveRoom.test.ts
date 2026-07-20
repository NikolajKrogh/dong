import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  useMyActiveRoom,
  type UseMyActiveRoomResult,
} from "../../hooks/useMyActiveRoom";
import type { MyActiveRoom } from "../../types/room";
import { getRoomRpcClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getRoomRpcClient: jest.fn(),
}));

const mockGetRoomRpcClient = jest.mocked(getRoomRpcClient);

const buildActiveRoom = (
  overrides: Partial<MyActiveRoom> = {},
): MyActiveRoom => ({
  sessionId: "session-1",
  participantId: "participant-1",
  role: "owner",
  joinCode: "123456",
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderMyActiveRoom = async (
  enabled: boolean,
): Promise<{
  result: () => UseMyActiveRoomResult | null;
  unmount: () => void;
}> => {
  let observed: UseMyActiveRoomResult | null = null;
  const Probe = () => {
    observed = useMyActiveRoom(enabled);
    return null;
  };
  const renderer = TestRenderer.create(React.createElement(Probe));
  await TestRenderer.act(async () => {
    await flush();
  });
  return { result: () => observed, unmount: () => renderer.unmount() };
};

describe("useMyActiveRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches and exposes the active room when enabled", async () => {
    const activeRoom = buildActiveRoom();
    const getMyActiveRoom = jest.fn(async () => activeRoom);
    mockGetRoomRpcClient.mockReturnValue({ getMyActiveRoom } as never);

    const { result, unmount } = await renderMyActiveRoom(true);

    expect(getMyActiveRoom).toHaveBeenCalledTimes(1);
    expect(result()?.activeRoom).toEqual(activeRoom);
    expect(result()?.isLoading).toBe(false);

    unmount();
  });

  it("exposes null when there is no active room", async () => {
    const getMyActiveRoom = jest.fn(async () => null);
    mockGetRoomRpcClient.mockReturnValue({ getMyActiveRoom } as never);

    const { result, unmount } = await renderMyActiveRoom(true);

    expect(result()?.activeRoom).toBeNull();

    unmount();
  });

  it("does not call the RPC and stays null when disabled", async () => {
    const getMyActiveRoom = jest.fn(async () => buildActiveRoom());
    mockGetRoomRpcClient.mockReturnValue({ getMyActiveRoom } as never);

    const { result, unmount } = await renderMyActiveRoom(false);

    expect(getMyActiveRoom).not.toHaveBeenCalled();
    expect(result()?.activeRoom).toBeNull();
    expect(result()?.isLoading).toBe(false);

    unmount();
  });

  it("clears the active room and swallows the error when the RPC rejects", async () => {
    const getMyActiveRoom = jest.fn(async () => {
      throw new Error("network error");
    });
    mockGetRoomRpcClient.mockReturnValue({ getMyActiveRoom } as never);

    const { result, unmount } = await renderMyActiveRoom(true);

    expect(result()?.activeRoom).toBeNull();
    expect(result()?.isLoading).toBe(false);

    unmount();
  });

  it("re-fetches when refresh() is called explicitly", async () => {
    const firstRoom = buildActiveRoom({ sessionId: "session-1" });
    const secondRoom = buildActiveRoom({ sessionId: "session-2" });
    const getMyActiveRoom = jest
      .fn<() => Promise<MyActiveRoom>>()
      .mockResolvedValueOnce(firstRoom)
      .mockResolvedValueOnce(secondRoom);
    mockGetRoomRpcClient.mockReturnValue({ getMyActiveRoom } as never);

    const { result, unmount } = await renderMyActiveRoom(true);
    expect(result()?.activeRoom).toEqual(firstRoom);

    await TestRenderer.act(async () => {
      await result()?.refresh();
    });

    expect(getMyActiveRoom).toHaveBeenCalledTimes(2);
    expect(result()?.activeRoom).toEqual(secondRoom);

    unmount();
  });

  it("clears to null when the hook re-runs after becoming disabled", async () => {
    const activeRoom = buildActiveRoom();
    const getMyActiveRoom = jest.fn(async () => activeRoom);
    mockGetRoomRpcClient.mockReturnValue({ getMyActiveRoom } as never);

    const observedStates: (UseMyActiveRoomResult | null)[] = [];
    const props = { enabled: true };
    const Probe = ({ enabled }: { enabled: boolean }) => {
      observedStates.push(useMyActiveRoom(enabled));
      return null;
    };

    const renderer = TestRenderer.create(React.createElement(Probe, props));
    await TestRenderer.act(async () => {
      await flush();
    });
    expect(observedStates[observedStates.length - 1]?.activeRoom).toEqual(
      activeRoom,
    );

    await TestRenderer.act(async () => {
      renderer.update(React.createElement(Probe, { enabled: false }));
      await flush();
    });

    expect(observedStates[observedStates.length - 1]?.activeRoom).toBeNull();
    expect(getMyActiveRoom).toHaveBeenCalledTimes(1);

    renderer.unmount();
  });
});
