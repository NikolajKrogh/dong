import React from "react";
import TestRenderer from "react-test-renderer";

import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import GameActionsSheet from "../../../components/gameProgress/GameActionsSheet";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

jest.mock("../../../styles/theme", () => {
  const actual = jest.requireActual("../../../styles/theme");

  return {
    ...actual,
    useColors: () => ({
      backgroundModalOverlay: "rgba(0,0,0,.5)",
      textMuted: "#666",
      danger: "#c00",
    }),
  };
});

describe("GameActionsSheet", () => {
  const createProps = (overrides: Record<string, any> = {}) => ({
    onBackToSetup: jest.fn(),
    onEndGame: jest.fn(),
    onHome: jest.fn(),
    onOpenChange: jest.fn(),
    onPositionChange: jest.fn(),
    open: true,
    position: 0,
    showEndGame: true,
    floatingToggle: React.createElement("View", { testID: "FloatingToggleMock" }),
    ...overrides,
  });

  const renderSheet = (props: ReturnType<typeof createProps>) => {
    return actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GameActionsSheet, props),
      ),
    );
  };

  it("uses fit mode without a fixed snap point", () => {
    const renderer = renderSheet(createProps());
    const sheet = renderer.root.findAll(
      (node) => node.props?.snapPointsMode === "fit",
    )[0];

    expect(sheet.props.snapPointsMode).toBe("fit");
    expect(sheet.props.snapPoints).toBeUndefined();
    expect(sheet.props.modal).toBe(true);
    expect(sheet.props.dismissOnOverlayPress).toBe(true);
    expect(sheet.props.dismissOnSnapToBottom).toBe(true);
    expect(renderer.root.findAllByProps({ testID: "FloatingToggleMock" }).length).toBeGreaterThan(0);
    expect(
      renderer.root
        .findAllByProps({ testID: "GameActionsSheetContent" })
        .some((node) => node.props.paddingBottom === 40),
    ).toBe(true);
    TestRenderer.act(() => renderer.unmount());
  });

  it("renders all permitted actions and wires their callbacks", () => {
    const props = createProps();
    const renderer = renderSheet(props);

    expect(
      renderer.root.findAllByProps({ testID: "GameActionsSheetTitle" }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: "FooterHomeButton" }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: "FooterSetupButton" }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: "FooterEndGameButton" }).length,
    ).toBeGreaterThan(0);

    const homeButton = renderer.root
      .findAllByProps({ testID: "FooterHomeButton" })
      .find((node) => typeof node.props.onPress === "function");
    const setupButton = renderer.root
      .findAllByProps({ testID: "FooterSetupButton" })
      .find((node) => typeof node.props.onPress === "function");
    const endGameButton = renderer.root
      .findAllByProps({ testID: "FooterEndGameButton" })
      .find((node) => typeof node.props.onPress === "function");
    TestRenderer.act(() => {
      homeButton?.props.onPress();
      setupButton?.props.onPress();
      endGameButton?.props.onPress();
    });

    expect(props.onHome).toHaveBeenCalledTimes(1);
    expect(props.onBackToSetup).toHaveBeenCalledTimes(1);
    expect(props.onEndGame).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => renderer.unmount());
  });

  it("shows End Game without allowing a non-host to trigger it", () => {
    const props = createProps({ showEndGame: false });
    const renderer = renderSheet(props);

    expect(
      renderer.root.findAllByProps({ testID: "FooterHomeButton" }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: "FooterSetupButton" }).length,
    ).toBeGreaterThan(0);
    const endGameButton = renderer.root
      .findAllByProps({ testID: "FooterEndGameButton" })
      .find((node) => node.props.disabled === true && node.props.onPress === undefined);
    expect(endGameButton).toBeDefined();
    expect(endGameButton?.props.disabled).toBe(true);
    expect(
      renderer.root.findAllByProps({ testID: "GameActionsEndGameHint" }).length,
    ).toBeGreaterThan(0);
    expect(props.onEndGame).not.toHaveBeenCalled();
    TestRenderer.act(() => renderer.unmount());
  });
});
