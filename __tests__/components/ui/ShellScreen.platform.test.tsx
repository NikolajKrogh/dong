import React from "react";
import TestRenderer from "react-test-renderer";

jest.mock("tamagui", () => {
  const ReactLocal = require("react");

  return {
    YStack: "View",
    styled: () => {
      return ({ children, ...props }: any) =>
        ReactLocal.createElement("View", props, children);
    },
  };
});

describe("ShellScreen primitive", () => {
  it("uses a dedicated centering viewport and keeps maxWidth on the content node", () => {
    const { ShellScreen } = require("../../../components/ui/ShellScreen");

    const renderer = TestRenderer.create(
      React.createElement(
        ShellScreen,
        {
          centerContent: true,
          contentMaxWidth: 720,
          padded: false,
        },
        React.createElement("Text", null, "Content"),
      ),
    );

    const views = renderer.root.findAllByType("View");

    expect(views).toHaveLength(3);
    expect(views[0].props.padded).toBe(false);
    expect(views[1].props.centered).toBe(true);
    expect(views[2].props.maxWidth).toBe(720);
    expect(views[2].props.centered).toBeUndefined();
  });

  it("leaves the viewport uncentered when centerContent is false", () => {
    const { ShellScreen } = require("../../../components/ui/ShellScreen");

    const renderer = TestRenderer.create(
      React.createElement(
        ShellScreen,
        null,
        React.createElement("Text", null, "Content"),
      ),
    );

    const views = renderer.root.findAllByType("View");

    expect(views).toHaveLength(3);
    expect(views[1].props.centered).toBe(false);
  });
});
