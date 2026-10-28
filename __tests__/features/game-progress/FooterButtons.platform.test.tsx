import React from "react";
import { Animated } from "react-native";
import TestRenderer from "react-test-renderer";

import { actCreate } from "../../../test-utils/render";
import FooterButtons from "../../../features/game-progress/FooterButtons";

jest.mock("../../../platform/navigation/taskNavigation", () => ({
  TaskOverlay: ({ open, onClose, children }: any) => children({
    open, dismiss: onClose, runAfterDismiss: (action: () => void) => { onClose(); action(); },
  }),
}));

let mockReducedMotion = false;
jest.mock("../../../platform/animation/useReducedMotion", () => ({ useReducedMotion: () => mockReducedMotion }));

const mockPush = jest.fn();
let mockGameActionsSheetProps: Record<string, any> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, dismissTo: mockPush }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    backgroundModalOverlay: "rgba(0,0,0,.5)",
    surface: "#fff",
    textMuted: "#666",
    danger: "#c00",
    white: "#fff",
    black: "#000",
    primary: "#08f",
  }),
}));

jest.mock("../../../features/game-progress/GameActionsSheet", () => {
  const ReactModule = jest.requireActual("react") as typeof React;

  return (props: Record<string, any>) => {
    mockGameActionsSheetProps = props;

    return props.open
      ? ReactModule.createElement(
          "View",
          { testID: "GameActionsSheetMock" },
          ReactModule.createElement("View", {
            testID: "GameActionsSheetFrame",
          }),
          props.floatingToggle,
        )
      : null;
  };
});

describe("FooterButtons", () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockPush.mockClear();
    mockGameActionsSheetProps = {};
  });

  it("opens and closes the extracted game-actions sheet", () => {
    const renderer = actCreate(
      React.createElement(FooterButtons, {
        onBackToSetup: jest.fn(),
        onEndGame: jest.fn(),
      }),
    );

    expect(mockGameActionsSheetProps.open).toBe(false);
    expect(mockGameActionsSheetProps.position).toBe(0);

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "GameProgressMenuButton" }).props.onPress();
    });
    expect(mockGameActionsSheetProps.open).toBe(true);
    expect(mockGameActionsSheetProps.position).toBe(0);
    expect(renderer.root.findByProps({ testID: "GameActionsSheetFrame" })).toBeDefined();
    expect(renderer.root.findByProps({ testID: "GameProgressMenuButton" }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: "GameProgressSheetMenuButton" }).props.disabled).toBe(false);

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "GameProgressSheetMenuButton" }).props.onPress();
    });
    expect(mockGameActionsSheetProps.open).toBe(false);
    expect(renderer.root.findAllByProps({ testID: "GameActionsSheetFrame" })).toHaveLength(0);

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "GameProgressMenuButton" }).props.onPress();
      mockGameActionsSheetProps.onOpenChange(false);
    });
    expect(mockGameActionsSheetProps.open).toBe(false);
  });

  it.each([false, true])("uses the reduced-motion policy for opening and closing (%s)", (reduced) => {
    mockReducedMotion = reduced;
    const timing = jest.mocked(Animated.timing);
    const tree = actCreate(<FooterButtons onBackToSetup={jest.fn()} onEndGame={jest.fn()} />);
    timing.mockClear();
    TestRenderer.act(() => tree.root.findByProps({ testID: "GameProgressMenuButton" }).props.onPress());
    const rotation = timing.mock.calls[0][0];
    TestRenderer.act(() => mockGameActionsSheetProps.onOpenChange(false));
    expect(timing.mock.calls.filter(([value]) => value === rotation).map(([, config]) => config.duration))
      .toEqual(reduced ? [0, 0] : [300, 300]);
    TestRenderer.act(() => tree.unmount());
  });

  it("closes before invoking the end-game callback", () => {
    const timingSpy = jest.spyOn(Animated, "timing");
    let timingCallsSeenByCallback = 0;
    const onEndGame = jest.fn(() => {
      timingCallsSeenByCallback = timingSpy.mock.calls.length;
    });
    const renderer = actCreate(
      React.createElement(FooterButtons, {
        onBackToSetup: jest.fn(),
        onEndGame,
      }),
    );

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "GameProgressMenuButton" }).props.onPress();
    });

    const timingCallsBeforeAction = timingSpy.mock.calls.length;
    TestRenderer.act(() => {
      mockGameActionsSheetProps.onEndGame();
    });

    expect(onEndGame).toHaveBeenCalledTimes(1);
    expect(timingCallsSeenByCallback).toBe(timingCallsBeforeAction + 1);
    expect(mockGameActionsSheetProps.open).toBe(false);

    timingSpy.mockRestore();
  });

  it("closes the sheet before asking to leave", () => {
    const timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
      () => ({ start: jest.fn() }) as any,
    );
    const onLeaveGame = jest.fn();
    const renderer = actCreate(React.createElement(FooterButtons, {
      onBackToSetup: jest.fn(), onEndGame: jest.fn(), onLeaveGame, showLeaveGame: true,
    }));
    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: "GameProgressMenuButton" }).props.onPress();
      mockGameActionsSheetProps.onLeaveGame();
    });
    expect(onLeaveGame).toHaveBeenCalledTimes(1);
    expect(mockGameActionsSheetProps.open).toBe(false);
    timingSpy.mockRestore();
  });
});
