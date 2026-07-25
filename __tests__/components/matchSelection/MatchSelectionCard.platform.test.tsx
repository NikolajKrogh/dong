import React from "react";
import { actCreate } from "../../../test-utils/render";

const mockStyles = {
  playerHeader: { testStyle: "playerHeader" },
  playerHeaderLeft: { testStyle: "playerHeaderLeft" },
  playerAssignmentName: { testStyle: "playerAssignmentName" },
  playerBadge: { testStyle: "playerBadge" },
  playerBadgeText: { testStyle: "playerBadgeText" },
  chevronIcon: { testStyle: "chevronIcon" },
};

jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: (o: Record<string, unknown>) => o.web ?? o.default,
  },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({ primary: "#p" }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const render = (props: Record<string, unknown> = {}) => {
  const {
    MatchSelectionCard,
  } = require("../../../components/matchSelection/MatchSelectionCard");

  return actCreate(
    React.createElement(
      MatchSelectionCard,
      {
        title: "Alice",
        selectedCount: 1,
        totalCount: 3,
        collapsed: false,
        onToggleCollapsed: jest.fn(),
        testID: "card",
        badgeTestID: "badge",
        ...props,
      },
      React.createElement("Text", { testID: "card-body" }, "body"),
    ),
  );
};

describe("MatchSelectionCard", () => {
  beforeEach(() => jest.clearAllMocks());

  // Both numbers are props because the solo flow counts against the pool while
  // the pick surfaces count against the per-player cap.
  it("renders the count badge exactly as given", () => {
    const renderer = render({ selectedCount: 2, totalCount: 5 });

    expect(
      renderer.root.findByProps({ testID: "badge" }).props.children.join(""),
    ).toBe("2/5");
  });

  it("hides its body when collapsed and shows it when expanded", () => {
    const collapsed = render({ collapsed: true });
    expect(collapsed.root.findAllByProps({ testID: "card-body" })).toHaveLength(
      0,
    );

    const expanded = render({ collapsed: false });
    expect(
      expanded.root.findAllByProps({ testID: "card-body" }).length,
    ).toBeGreaterThan(0);
  });

  it("reports header taps to the caller, which owns collapse state", () => {
    const onToggleCollapsed = jest.fn();
    const renderer = render({ onToggleCollapsed });

    renderer.root
      .findByProps({ style: mockStyles.playerHeader })
      .props.onPress();

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  // Callers' existing tests assert on props.style of the node carrying testID,
  // so the prop must be named `style` and reach the outer container.
  it("passes its style through to the node carrying its testID", () => {
    const style = [{ testStyle: "outer" }];
    const renderer = render({ style });

    renderer.root
      .findAllByProps({ testID: "card" })
      .forEach((node) => expect(node.props.style).toEqual(style));
  });
});
