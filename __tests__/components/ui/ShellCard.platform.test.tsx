import React from "react";
import TestRenderer from "react-test-renderer";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

describe("ShellCard primitive", () => {
  it("renders children inside the card frame", () => {
    const { ShellCard } = require("../../../components/ui/ShellCard");
    const tree = TestRenderer.create(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(ShellCard, null, "Card content")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });

  it("accepts the elevated variant", () => {
    const { ShellCard } = require("../../../components/ui/ShellCard");
    const tree = TestRenderer.create(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(ShellCard, { elevated: true }, "Elevated card")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });

  it("accepts the compact variant", () => {
    const { ShellCard } = require("../../../components/ui/ShellCard");
    const tree = TestRenderer.create(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(ShellCard, { compact: true }, "Compact card")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });

  it("renders in dark theme without crashing", () => {
    const { ShellCard } = require("../../../components/ui/ShellCard");
    const tree = TestRenderer.create(
      React.createElement(
        TamaguiTestProvider,
        { theme: "dark" },
        React.createElement(ShellCard, null, "Dark card")
      )
    );
    expect(tree.toJSON()).toBeDefined();
  });
});
