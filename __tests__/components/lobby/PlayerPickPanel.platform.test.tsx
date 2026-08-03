import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

// Partial mock: Text/XStack/YStack are swapped for plain host tags so this
// suite can assert on PlainPickPanel's own structure without rendering real
// Tamagui primitives, but everything else (createTamagui, createTokens,
// TamaguiProvider, ...) stays real -- TamaguiTestProvider below needs those to
// build an actual theme/config context, which the babel-plugin-generated style
// code in PlayerPickPanel.tsx requires even though its Text/XStack/YStack are
// mocked (see the comment on `render` below).
jest.mock("tamagui", () => {
  const actual = jest.requireActual("tamagui");
  return {
    ...actual,
    Text: "Text",
    XStack: "XStack",
    YStack: "YStack",
  };
});

jest.mock("../../../components/ui", () => ({
  ShellActionButton: "ShellActionButton",
}));

// The shared list is exercised by its own suite; here it is reduced to a probe so
// these tests assert the panel's *decisions* (what is selected, what is disabled,
// what gets submitted) rather than re-testing the markup.
jest.mock("../../../components/matchSelection/SelectableMatchList", () => ({
  SelectableMatchList: "SelectableMatchList",
}));

jest.mock("../../../components/matchSelection/MatchSelectionCard", () => {
  // Required inside the factory: jest.mock bodies may not close over
  // out-of-scope variables.
  const mockReact = require("react");

  return {
    MatchSelectionCard: ({
      children,
      selectedCount,
      totalCount,
      testID,
      badgeTestID,
    }: {
      children: unknown;
      selectedCount: number;
      totalCount: number;
      testID?: string;
      badgeTestID?: string;
    }) =>
      mockReact.createElement(
        "MatchSelectionCard",
        { testID, badgeTestID, selectedCount, totalCount },
        children,
      ),
  };
});

const MATCHES = [
  { id: "m1", homeTeam: "Arsenal", awayTeam: "Chelsea" },
  { id: "m2", homeTeam: "Liverpool", awayTeam: "Spurs" },
  { id: "m3", homeTeam: "Leeds", awayTeam: "Villa" },
];

// PlayerPickPanel's own JSX uses tamagui style shorthand props (gap="$2",
// color="$colorMuted", ...), so the babel plugin statically wraps those
// elements in Tamagui's internal _withStableStyle at compile time -- this
// happens regardless of the "tamagui" module mock above, which only affects
// what YStack/Text/XStack resolve to at runtime, not the generated style
// code. Without a real TamaguiProvider ancestor supplying a theme, that
// generated code crashes reading .get off an empty fallback theme object, so
// a real (unmocked-tamagui-module-notwithstanding) provider is still required.
const render = (props: Record<string, unknown> = {}) => {
  const {
    PlayerPickPanel,
  } = require("../../../components/lobby/PlayerPickPanel");
  const {
    TamaguiTestProvider,
  } = require("../../../test-utils/tamagui");

  return actCreate(
    React.createElement(
      TamaguiTestProvider,
      null,
      React.createElement(PlayerPickPanel, {
        matches: MATCHES,
        myPicks: [],
        cap: 2,
        onSetPicks: jest.fn(),
        ...props,
      }),
    ),
  );
};

const list = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findByType("SelectableMatchList" as never);

describe("PlayerPickPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("seeds its selection from the participant's stored picks", () => {
    const renderer = render({ myPicks: ["m2"] });

    expect(list(renderer).props.selectedMatchIds).toEqual(["m2"]);
    expect(
      renderer.root.findByProps({ badgeTestID: "lobby-player-pick-panel-count" })
        .props.selectedCount,
    ).toBe(1);
  });

  it("submits the complete next set when a match is picked", () => {
    const onSetPicks = jest.fn();
    const renderer = render({ myPicks: ["m1"], onSetPicks });

    TestRenderer.act(() => {
      list(renderer).props.onToggleMatch("m2");
    });

    // Replace-all: the whole set, not a delta.
    expect(onSetPicks).toHaveBeenCalledWith(["m1", "m2"]);
  });

  it("releases a pick by submitting the set without it", () => {
    const onSetPicks = jest.fn();
    const renderer = render({ myPicks: ["m1", "m2"], onSetPicks });

    TestRenderer.act(() => {
      list(renderer).props.onToggleMatch("m1");
    });

    expect(onSetPicks).toHaveBeenCalledWith(["m2"]);
  });

  /**
   * The reason this component holds local state at all. `myPicks` comes from a
   * poll that lags by up to ~4s, so a second tap that derived its array from the
   * prop would submit [B] and silently discard A.
   */
  it("keeps a second pick additive when the stored picks prop has not caught up", () => {
    const onSetPicks = jest.fn();
    const renderer = render({ myPicks: [], onSetPicks, cap: 3 });

    TestRenderer.act(() => {
      list(renderer).props.onToggleMatch("m1");
    });
    TestRenderer.act(() => {
      list(renderer).props.onToggleMatch("m2");
    });

    expect(onSetPicks).toHaveBeenNthCalledWith(1, ["m1"]);
    expect(onSetPicks).toHaveBeenNthCalledWith(2, ["m1", "m2"]);
  });

  it("re-seeds when the server's view of the picks actually changes", () => {
    const renderer = render({ myPicks: ["m1"] });

    TestRenderer.act(() => {
      renderer.update(
        React.createElement(
          require("../../../test-utils/tamagui").TamaguiTestProvider,
          null,
          React.createElement(
            require("../../../components/lobby/PlayerPickPanel").PlayerPickPanel,
            {
              matches: MATCHES,
              myPicks: ["m3"],
              cap: 2,
              onSetPicks: jest.fn(),
            },
          ),
        ),
      );
    });

    expect(list(renderer).props.selectedMatchIds).toEqual(["m3"]);
  });

  // FR-040: at the cap the unpicked matches go inert, but the picked ones stay
  // tappable so a participant can always release one.
  it("disables only unpicked matches once the cap is reached", () => {
    const renderer = render({ myPicks: ["m1", "m2"], cap: 2 });

    expect(list(renderer).props.disabledMatchIds).toEqual(["m3"]);
  });

  it("refuses to submit a set larger than the cap", () => {
    const onSetPicks = jest.fn();
    const renderer = render({ myPicks: ["m1", "m2"], cap: 2, onSetPicks });

    TestRenderer.act(() => {
      list(renderer).props.onToggleMatch("m3");
    });

    expect(onSetPicks).not.toHaveBeenCalled();
  });

  it("disables everything while a submission is in flight", () => {
    const renderer = render({ myPicks: ["m1"], isBusy: true });

    expect(list(renderer).props.disabledMatchIds).toEqual(["m1", "m2", "m3"]);
  });

  it("shows the cap as the badge denominator, not the pool size", () => {
    const renderer = render({ myPicks: ["m1"], cap: 2 });
    const card = renderer.root.findByProps({
      badgeTestID: "lobby-player-pick-panel-count",
    });

    expect(card.props.selectedCount).toBe(1);
    expect(card.props.totalCount).toBe(2);
  });

  it("offers a release-all action only once something is picked", () => {
    const empty = render({ myPicks: [] });
    expect(
      empty.root.findAllByProps({
        testID: "lobby-player-pick-panel-release-all",
      }),
    ).toHaveLength(0);

    const onSetPicks = jest.fn();
    const picked = render({ myPicks: ["m1"], onSetPicks });
    const button = picked.root.findByProps({
      testID: "lobby-player-pick-panel-release-all",
    });

    TestRenderer.act(() => {
      button.props.onPress();
    });

    expect(onSetPicks).toHaveBeenCalledWith([]);
  });
  // A per-player count of zero is valid (specs/020 edge cases): everyone holds
  // the Common Match alone, so nothing is pickable.
  it("offers nothing to pick when the per-player count is zero", () => {
    const onSetPicks = jest.fn();
    const renderer = render({ myPicks: [], cap: 0, onSetPicks });

    expect(list(renderer).props.disabledMatchIds).toEqual([
      "m1",
      "m2",
      "m3",
    ]);

    TestRenderer.act(() => {
      list(renderer).props.onToggleMatch("m1");
    });
    expect(onSetPicks).not.toHaveBeenCalled();
  });
});
