import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

let mockTheme = "light";
jest.mock("../../../store/gameStore", () => ({
  useGameStore: (selector: (state: { theme: string }) => unknown) => selector({ theme: mockTheme }),
}));

describe("TamaguiAppProvider theme-bridge regression", () => {
  beforeEach(() => { mockTheme = "light"; });
  it.each(["light", "dark"])("passes the persisted %s theme to Tamagui and follows changes", (theme) => {
    const { TamaguiAppProvider } = require("../../../components/ui/TamaguiAppProvider");
    const { TamaguiProvider } = require("tamagui");
    mockTheme = theme;
    const tree = actCreate(<TamaguiAppProvider><span>child</span></TamaguiAppProvider>);
    expect(tree.root.findByType(TamaguiProvider).props.defaultTheme).toBe(theme);
    mockTheme = theme === "light" ? "dark" : "light";
    TestRenderer.act(() => tree.update(<TamaguiAppProvider><span>child</span></TamaguiAppProvider>));
    expect(tree.root.findByType(TamaguiProvider).props.defaultTheme).toBe(mockTheme);
  });

  it("renders an open real Sheet under the app provider without a portal-context error", () => {
    const { TamaguiAppProvider } = require("../../../components/ui/TamaguiAppProvider");
    const { Sheet } = require("tamagui");

    let tree: TestRenderer.ReactTestRenderer | null = null;
    expect(() => {
      tree = actCreate(
        React.createElement(
          TamaguiAppProvider,
          null,
          React.createElement(
            Sheet,
            { open: true, modal: true, snapPoints: [32], snapPointsMode: "percent" },
            React.createElement(Sheet.Overlay),
            React.createElement(Sheet.Handle),
            React.createElement(
              Sheet.Frame,
              { testID: "PortalRegressionSheetFrame" },
              React.createElement("div", null, "sheet child"),
            ),
          ),
        ),
      );
    }).not.toThrow();
    TestRenderer.act(() => tree?.unmount());
  });
});
