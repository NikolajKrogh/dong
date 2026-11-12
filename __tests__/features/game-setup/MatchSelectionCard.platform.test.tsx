import React from "react";
import { act } from "react-test-renderer";
import { View } from "react-native";
import { MatchSelectionCard } from "../../../features/game-setup/MatchSelectionCard";
import { ShellCard } from "../../../components/ui/ShellCard";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import { actCreate } from "../../../test-utils/render";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

const renderCard = (props: Partial<React.ComponentProps<typeof MatchSelectionCard>> = {}) => actCreate(
  <TamaguiTestProvider>
    <MatchSelectionCard title="Alice" selectedCount={1} totalCount={3} collapsed={false}
      onToggleCollapsed={jest.fn()} testID="card" badgeTestID="badge" {...props}>
      <View testID="card-body" />
    </MatchSelectionCard>
  </TamaguiTestProvider>,
);

describe("MatchSelectionCard", () => {
  it("renders the selected count and target", () => {
    const tree = renderCard({ selectedCount: 2, totalCount: 5 });
    const badge = tree.root.findAll(node => typeof node.type === "string" && node.props.testID === "badge")[0];
    expect(badge.props.children.join("")).toBe("2/5");
  });

  it("keeps a customized badge outside the disclosure without duplicating it", () => {
    const tree = renderCard({ collapsed: true, renderBadge: badge => <View testID="count-controls">{badge}</View> });
    expect(tree.root.findAll(node => typeof node.type === "string" && node.props.testID === "badge")).toHaveLength(1);
    const disclosure = tree.root.findAllByProps({ accessibilityLabel: "Alice, 1 of 3 matches" })[0];
    expect(disclosure.findAllByProps({ testID: "badge" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "count-controls" }).length).toBeGreaterThan(0);
  });

  it("hides its body while collapsed", () => {
    const tree = renderCard({ collapsed: true });
    expect(tree.root.findAllByProps({ testID: "card-body" })).toHaveLength(0);
  });

  it("shows the body while expanded", () => {
    const tree = renderCard();
    expect(tree.root.findAllByProps({ testID: "card-body" }).length).toBeGreaterThan(0);
  });

  it("reports header taps to the caller", () => {
    const onToggleCollapsed = jest.fn();
    const tree = renderCard({ onToggleCollapsed });
    act(() => tree.root.findAllByProps({ accessibilityLabel: "Alice, 1 of 3 matches" })[0].props.onPress());
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("preserves caller sizing", () => {
    const style = { width: "48%" } as const;
    const tree = renderCard({ style });
    expect(tree.root.findByType(ShellCard).props.style).toEqual(style);
  });
});
