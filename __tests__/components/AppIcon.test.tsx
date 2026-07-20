import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";
import AppIcon from "../../components/AppIcon";

jest.mock("@expo/vector-icons", () => {
  const ReactNative = require("react-native");

  return {
    Ionicons: ({ name, size, color, style }: any) => (
      <ReactNative.Text testID="ionicon" style={style}>
        {`Icon:${name} Size:${size} Color:${color}`}
      </ReactNative.Text>
    ),
  };
});

describe("AppIcon", () => {
  it.each([
    ["football-outline", "football-outline"],
    ["funnel-outline", "funnel-outline"],
    ["person-circle-outline", "person-circle-outline"],
  ] as const)("renders %s through Ionicons", (name, expectedIconName) => {
    const renderer = actCreate(
      <AppIcon name={name} size={24} color="#123456" />,
    );

    const icon = renderer.root.findByProps({ testID: "ionicon" });

    expect(icon.props.children).toBe(
      `Icon:${expectedIconName} Size:24 Color:#123456`,
    );
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("forwards style to the Ionicons renderer", () => {
    const renderer = actCreate(
      <AppIcon
        name="arrow-back"
        size={20}
        color="#ffffff"
        style={{ marginRight: 8, opacity: 0.5 }}
      />,
    );

    const icon = renderer.root.findByProps({ testID: "ionicon" });

    expect(icon.props.style).toMatchObject({ marginRight: 8, opacity: 0.5 });
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
