import React from "react";
import { Platform } from "react-native";

import { actCreate } from "../../../test-utils/render";

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

    const renderer = actCreate(
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

    const views = renderer.root.findAll((node) => String(node.type) === "View");

    expect(views).toHaveLength(3);
    expect(views[0].props.padded).toBe(false);
    expect(views[1].props.centered).toBe(true);
    expect(views[2].props.maxWidth).toBe(720);
    expect(views[2].props.centered).toBeUndefined();
  });

  it("leaves the viewport uncentered when centerContent is false", () => {
    const { ShellScreen } = require("../../../components/ui/ShellScreen");

    const renderer = actCreate(
      React.createElement(
        ShellScreen,
        null,
        React.createElement("Text", null, "Content"),
      ),
    );

    const views = renderer.root.findAll((node) => String(node.type) === "View");

    expect(views).toHaveLength(3);
    expect(views[1].props.centered).toBe(false);
  });
});


it('adds one web main landmark even when shells are nested', () => {
  const original = Platform.OS;
  Platform.OS = 'web';
  try {
    const { ShellScreen } = require('../../../components/ui/ShellScreen');
    const renderer = actCreate(<ShellScreen><ShellScreen>Nested content</ShellScreen></ShellScreen>);
    expect(renderer.root.findAll((node) => String(node.type) === 'View' && node.props.render === 'main')).toHaveLength(1);
    require('react-test-renderer').act(() => renderer.unmount());
  } finally { Platform.OS = original; }
});
