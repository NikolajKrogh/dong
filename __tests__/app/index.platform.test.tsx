import React from "react";
import TestRenderer from "react-test-renderer";

const mockPlatformAnimation = jest.fn(() => null);

jest.mock("../../platform", () => ({
  PlatformAnimation: mockPlatformAnimation,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("../../store/store", () => ({
  useGameStore: () => ({
    players: [],
    matches: [],
    history: [],
    resetState: jest.fn(),
  }),
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({
    background: "#f5f5f5",
    white: "#ffffff",
  }),
}));

jest.mock("../../app/style/indexStyles", () => ({
  __esModule: true,
  default: () => ({
    splashContainer: {},
    splashAnimation: {},
    safeArea: { backgroundColor: "#ffffff" },
  }),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("true"),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../components/OnboardingScreen", () => () => null);

describe("HomeScreen platform adoption", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPlatformAnimation.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("uses the shared animation adapter for the splash state", () => {
    const HomeScreen = require("../../app/index").default;

    const renderer = TestRenderer.create(React.createElement(HomeScreen));

    expect(mockPlatformAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "splash" }),
      {},
    );

    TestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });

    renderer.unmount();
  });
});
