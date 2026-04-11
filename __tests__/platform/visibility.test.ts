import { createReactNativePlatformMock } from "../../test-utils/platform";

describe("platform visibility adapters", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("normalizes app state snapshots", () => {
    const {
      createAppStateSnapshot,
      createDocumentVisibilitySnapshot,
    } = require("../../platform/visibility/normalizeVisibility");

    expect(createAppStateSnapshot("active", 10)).toEqual({
      state: "active",
      source: "appState",
      isInteractive: true,
      capturedAt: 10,
    });

    expect(createDocumentVisibilitySnapshot("hidden", 20)).toEqual({
      state: "hidden",
      source: "document",
      isInteractive: false,
      capturedAt: 20,
    });
  });

  it("tracks browser visibility changes on web", () => {
    const listeners: Record<string, () => void> = {};

    (globalThis as { window?: unknown }).window = {};
    (globalThis as { document?: unknown }).document = {
      visibilityState: "visible",
      addEventListener: jest.fn((event: string, listener: () => void) => {
        listeners[event] = listener;
      }),
      removeEventListener: jest.fn(),
    };

    jest.doMock("react-native", () => ({
      ...createReactNativePlatformMock("web"),
      AppState: {
        currentState: "active",
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
    }));

    let observedState = "";

    jest.isolateModules(() => {
      const React = require("react");
      const TestRenderer = require("react-test-renderer");
      const { useAppVisibility } = require("../../platform/visibility/useAppVisibility");

      const Probe = () => {
        observedState = useAppVisibility().visibilityState;
        return null;
      };

      TestRenderer.act(() => {
        TestRenderer.create(React.createElement(Probe));
      });

      expect(observedState).toBe("active");

      TestRenderer.act(() => {
        (globalThis.document as { visibilityState: string }).visibilityState = "hidden";
        listeners.visibilitychange?.();
      });

      expect(observedState).toBe("hidden");
    });
  });
});