import React from "react";
import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import { ShellCard } from "../../../components/ui/ShellCard";

describe("ShellCard primitive", () => {
  it.each([
    { name: "default", props: {}, theme: "light" },
    { name: "elevated", props: { elevated: true }, theme: "light" },
    { name: "compact", props: { compact: true }, theme: "light" },
    { name: "dark theme", props: {}, theme: "dark" },
  ] as const)("keeps its content in the $name card", ({ props, theme }) => {
    const tree = actCreate(
      <TamaguiTestProvider theme={theme}>
        <ShellCard {...props}><span>Card content</span></ShellCard>
      </TamaguiTestProvider>,
    );
    expect(tree.root.findByType("span").props.children).toBe("Card content");
  });
});
