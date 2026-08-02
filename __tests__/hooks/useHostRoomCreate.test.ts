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

    expect(observedHook?.error).toBe("Sign in to create a room.");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("explains the one-active-room rule when the RPC refuses on it", async () => {
    // The shape that matters: Supabase rejects with a PostgrestError, a plain
    // object rather than an Error. The old `err instanceof Error` test never
    // matched it, so every real failure read "Failed to create room." and the
    // reason lived only in the Postgres log.
    const createRoomAsHost = jest.fn(async () => {
      throw {
        message: "already_in_active_room",
        code: "P0001",
        details: null,
        hint: null,
      };
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

    // Cast because the assign-in-closure pattern this file uses narrows
    // `observedHook` to `never` after the render callbacks.
    const observed = observedHook as UseHostRoomCreateResult | null;
    expect(observed?.error).toBe(
      "You're already in a room. Leave or end it before creating another.",
    );
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
