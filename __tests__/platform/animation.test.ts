import { canUseNativeAnimation, getAnimationFallback } from "../../platform/animation/fallbacks";
import { createReactNativePlatformMock } from "../../test-utils/platform";

describe("platform animation adapters", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("selects explicit loading fallbacks on web", () => {
    expect(getAnimationFallback("loading", "web")).toMatchObject({
      useNativeRenderer: false,
      fallbackType: "alternateUI",
    });
    expect(canUseNativeAnimation("splash", "web")).toBe(false);
  });

  it("renders the provided fallback when native animation is unavailable", () => {
    jest.doMock("react-native", () => createReactNativePlatformMock("web"));
    jest.doMock("../../app/style/theme", () => ({
      useColors: () => ({
        textPrimary: "#111111",
      }),
    }));

    jest.isolateModules(() => {
      const React = require("react");
      const TestRenderer = require("react-test-renderer");
      const { Text } = require("react-native");
      const { PlatformAnimation } = require("../../platform/animation/PlatformAnimation");

      const tree = TestRenderer.create(
        React.createElement(PlatformAnimation, {
          kind: "loading",
          source: {},
          fallback: React.createElement(Text, null, "Loading fallback"),
        })
      );

      expect(tree.root.findByType(Text).props.children).toBe("Loading fallback");
    });
  });
});