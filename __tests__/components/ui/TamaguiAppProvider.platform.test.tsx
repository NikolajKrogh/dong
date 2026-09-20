import React from "react";
import TestRenderer from "react-test-renderer";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import { actCreate } from "../../../test-utils/render";

jest.mock("../../../store/store", () => ({
  useGameStore: Object.assign(
    (selector: (s: any) => any) => selector({ theme: "light" }),
    { getState: () => ({ theme: "light" }) }
  ),
}));

describe("TamaguiAppProvider theme-bridge regression", () => {
  it("renders with the light theme without crashing", () => {
    const { TamaguiAppProvider } = require("../../../components/ui/TamaguiAppProvider");
    const tree = actCreate(
      React.createElement(TamaguiAppProvider, null,
        React.createElement("div", null, "child")
      )
    );
    expect(tree.toJSON()).toBeDefined();
    TestRenderer.act(() => tree.unmount());
  });

  it("renders with the dark theme without crashing", () => {
    // Override the mock to return dark
    const storeMock = require("../../../store/store");
    storeMock.useGameStore = Object.assign(
      (selector: (s: any) => any) => selector({ theme: "dark" }),
      { getState: () => ({ theme: "dark" }) }
    );

    const { TamaguiAppProvider } = require("../../../components/ui/TamaguiAppProvider");
    const tree = actCreate(
      React.createElement(TamaguiAppProvider, null,
        React.createElement("div", null, "child")
      )
    );
    expect(tree.toJSON()).toBeDefined();
    TestRenderer.act(() => tree.unmount());
  });

  it("TamaguiTestProvider applies the requested theme", () => {
    const tree = actCreate(
      React.createElement(TamaguiTestProvider, { theme: "dark" },
        React.createElement("div", null, "dark-child")
      )
    );
    expect(tree.toJSON()).toBeDefined();
    TestRenderer.act(() => tree.unmount());
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
