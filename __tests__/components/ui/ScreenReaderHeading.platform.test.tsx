import React from "react";
import { Platform } from "react-native";
import { actCreate } from "../../../test-utils/render";
import { ScreenReaderHeading } from "../../../components/ui/ScreenReaderHeading";

describe("screen identification without a visible title", () => {
  const originalPlatform = Platform.OS;
  afterEach(() => { Platform.OS = originalPlatform; });

  it("keeps the web heading outside normal layout", () => {
    Platform.OS = "web";
    const tree = actCreate(<ScreenReaderHeading>Home</ScreenReaderHeading>);
    expect(tree.root.findByType("h1").props).toMatchObject({
      children: "Home",
      style: { position: "absolute", width: 1, height: 1, clipPath: "inset(50%)" },
    });
  });

  it("adds no label or layout node to Android", () => {
    Platform.OS = "android";
    const tree = actCreate(<ScreenReaderHeading>Home</ScreenReaderHeading>);
    expect(tree.toJSON()).toBeNull();
  });
});
