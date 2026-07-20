import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";
import { View } from "react-native";

const mockPlatformGestureView = jest.fn(
  ({ children }: { children: React.ReactNode }) => {
    const ReactLocal = require("react");
    return ReactLocal.createElement(View, null, children);
  },
);

jest.mock("../../platform", () => ({
  PlatformGestureView: mockPlatformGestureView,
}));

jest.mock("../../app/style/theme", () => ({
  useColors: () => ({
    surface: "#ffffff",
    primary: "#123456",
    textMuted: "#333333",
    black: "#000000",
    white: "#ffffff",
    border: "#dddddd",
  }),
}));

describe("OnboardingScreen platform adoption", () => {
  it("keeps visible skip and continue controls available", () => {
    const onFinish = jest.fn();
    const OnboardingScreen =
      require("../../components/OnboardingScreen").default;

    const renderer = actCreate(
      React.createElement(OnboardingScreen, { onFinish }),
    );

    expect(mockPlatformGestureView).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "onboardingSwipe" }),
      undefined,
    );

    // react-test-renderer under React 19 no longer matches memo-wrapped
    // built-ins (e.g. RN's Pressable) via findAllByType, so query by props.
    const findPressables = () =>
      renderer.root.findAll(
        (node) => typeof node.props.onPress === "function",
      );

    const pressSkip = () => {
      findPressables()[0].props.onPress();
    };

    const pressContinue = () => {
      findPressables()[1].props.onPress();
    };

    TestRenderer.act(() => {
      pressSkip();
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    onFinish.mockClear();

    TestRenderer.act(() => {
      pressContinue();
    });

    TestRenderer.act(() => {
      pressContinue();
    });

    TestRenderer.act(() => {
      pressContinue();
    });

    TestRenderer.act(() => {
      pressContinue();
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
