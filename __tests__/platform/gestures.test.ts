import {
  getGestureFallback,
  supportsGestureEnhancement,
} from "../../platform/gestures/fallbacks";
import { createReactNativePlatformMock } from "../../test-utils/platform";

describe("platform gesture adapters", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("disables gesture enhancement on web", () => {
    expect(getGestureFallback("tabSwipe", "web")).toMatchObject({
      enabled: false,
      fallbackType: "primaryControlOnly",
    });
    expect(supportsGestureEnhancement("onboardingSwipe", "web")).toBe(false);
  });

  it("renders only the active tab when gestures are disabled", () => {
    jest.doMock("react-native", () => createReactNativePlatformMock("web"));

    jest.isolateModules(() => {
      const React = require("react");
      const TestRenderer = require("react-test-renderer");
      const { Text, View } = require("react-native");
      const {
        PlatformSwipeTabs,
      } = require("../../platform/gestures/PlatformSwipeTabs");

      const tree = TestRenderer.create(
        React.createElement(
          PlatformSwipeTabs,
          {
            activeIndex: 1,
            onIndexChange: jest.fn(),
            pageWidth: 320,
            pageStyle: { width: 999 },
          },
          React.createElement(Text, null, "Matches"),
          React.createElement(Text, null, "Players"),
        ),
      );

      expect(
        tree.root.findAllByType(Text).map((node: any) => node.props.children),
      ).toEqual(["Players"]);

      const pageViews = tree.root.findAllByType(View);

      expect(pageViews[1].props.style).toEqual([
        { width: 999 },
        { width: 320 },
      ]);
    });
  });
});
