import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import {
  useHostRoomCreate,
  type UseHostRoomCreateResult,
} from "../../hooks/useHostRoomCreate";
import type { HostRoomCreateResponse } from "../../types/hostRoom";
import { getHostRoomRpcClient } from "../../utils/supabaseClient";

jest.mock("../../utils/supabaseClient", () => ({
  getHostRoomRpcClient: jest.fn(),
}));

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

const mockGetHostRoomRpcClient = jest.mocked(getHostRoomRpcClient);

const createHostRoomResponse = (
  overrides: Partial<HostRoomCreateResponse> = {},
): HostRoomCreateResponse => ({
  sessionId: "session-uuid-1",
  joinCode: "123456",
  hostParticipantId: "participant-uuid-1",
  hostDisplayName: "Test Host",
  ...overrides,
});

describe("useHostRoomCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions isCreating false → true → false across a successful call", async () => {
    const createRoomAsHost = jest.fn(async () => createHostRoomResponse());

    mockGetHostRoomRpcClient.mockReturnValue({ createRoomAsHost });

    const isCreatingStates: boolean[] = [];
    let observedHook: UseHostRoomCreateResult | null = null;

    const Probe = () => {
      observedHook = useHostRoomCreate();
      isCreatingStates.push(observedHook.isCreating);
      return null;
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(Probe));
    });

    let createRoomPromise: ReturnType<
      NonNullable<UseHostRoomCreateResult["createRoom"]>
    >;
    TestRenderer.act(() => {
      createRoomPromise = observedHook!.createRoom();
    });

    await TestRenderer.act(async () => {
      await createRoomPromise;
    });

    TestRenderer.act(() => {
      renderer.unmount();
    });

    expect(isCreatingStates).toContain(false);
    expect(isCreatingStates).toContain(true);
    expect(isCreatingStates[isCreatingStates.length - 1]).toBe(false);
  });

  it("calls router.push with correct pathname and all four params on success", async () => {
    const response = createHostRoomResponse({
      sessionId: "abc-session",
      joinCode: "654321",
      hostParticipantId: "abc-participant",
      hostDisplayName: "Alice",
    });
    const createRoomAsHost = jest.fn(async () => response);

    mockGetHostRoomRpcClient.mockReturnValue({ createRoomAsHost });

    let observedHook: UseHostRoomCreateResult | null = null;

    const Probe = () => {
      observedHook = useHostRoomCreate();
      return null;
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(Probe));
    });

    await TestRenderer.act(async () => {
      await observedHook?.createRoom();
    });

    TestRenderer.act(() => {
      renderer.unmount();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/lobby/[sessionId]",
      params: {
        sessionId: "abc-session",
        participantId: "abc-participant",
      },
    });
  });

  it("sets error and does not call router.push when RPC throws", async () => {
    const createRoomAsHost = jest.fn(async () => {
      throw new Error("not_authenticated");
    });

    mockGetHostRoomRpcClient.mockReturnValue({ createRoomAsHost });

    let observedHook: UseHostRoomCreateResult | null = null;

    const Probe = () => {
      observedHook = useHostRoomCreate();
      return null;
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(Probe));
    });

    await TestRenderer.act(async () => {
      await observedHook?.createRoom();
    });

    TestRenderer.act(() => {
      renderer.unmount();
    });

    expect(observedHook?.error).toBe("not_authenticated");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets isCreating to false after an RPC error", async () => {
    const createRoomAsHost = jest.fn(async () => {
      throw new Error("create_room_code_exhausted");
    });

    mockGetHostRoomRpcClient.mockReturnValue({ createRoomAsHost });

    let observedHook: UseHostRoomCreateResult | null = null;

    const Probe = () => {
      observedHook = useHostRoomCreate();
      return null;
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(Probe));
    });

    await TestRenderer.act(async () => {
      await observedHook?.createRoom();
    });

    TestRenderer.act(() => {
      renderer.unmount();
    });

    expect(observedHook?.isCreating).toBe(false);
  });
});
