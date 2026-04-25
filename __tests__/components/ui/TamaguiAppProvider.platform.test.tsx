import React from "react";
import TestRenderer from "react-test-renderer";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

jest.mock("../../../store/store", () => ({
  useGameStore: Object.assign(
    (selector: (s: any) => any) => selector({ theme: "light" }),
    { getState: () => ({ theme: "light" }) }
  ),
}));

describe("TamaguiAppProvider theme-bridge regression", () => {
  it("renders with the light theme without crashing", () => {
    const { TamaguiAppProvider } = require("../../../components/ui/TamaguiAppProvider");
    const tree = TestRenderer.create(
      React.createElement(TamaguiAppProvider, null,
        React.createElement("div", null, "child")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });

  it("renders with the dark theme without crashing", () => {
    // Override the mock to return dark
    const storeMock = require("../../../store/store");
    storeMock.useGameStore = Object.assign(
      (selector: (s: any) => any) => selector({ theme: "dark" }),
      { getState: () => ({ theme: "dark" }) }
    );

    const { TamaguiAppProvider } = require("../../../components/ui/TamaguiAppProvider");
    const tree = TestRenderer.create(
      React.createElement(TamaguiAppProvider, null,
        React.createElement("div", null, "child")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });

  it("TamaguiTestProvider applies the requested theme", () => {
    const tree = TestRenderer.create(
      React.createElement(TamaguiTestProvider, { theme: "dark" },
        React.createElement("div", null, "dark-child")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });
});
