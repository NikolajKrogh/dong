import React from "react";
import { Animated } from "react-native";

import { actCreate } from "../../../test-utils/render";
import { ScoreControls } from "../../../components/gameProgress/MatchQuickActionsModal/ScoreControls";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({ white: "#fff" }),
}));

describe("ScoreControls editability", () => {
  it("disables manual score handlers and button animations", () => {
    const increment = jest.fn();
    const decrement = jest.fn();
    const animate = jest.fn();
    const value = () => new Animated.Value(1);
    const renderer = actCreate(
      <ScoreControls
        matchId="match-1"
        homeGoals={0}
        awayGoals={0}
        isApiControlledMatch={false}
        liveHomeScore={0}
        liveAwayScore={0}
        goalValueAnimHome={value()}
        goalValueAnimAway={value()}
        incrementAnimHome={value()}
        decrementAnimHome={value()}
        incrementAnimAway={value()}
        decrementAnimAway={value()}
        animateButtonPress={animate}
        handleGoalIncrement={increment}
        handleGoalDecrement={decrement}
        disabled
        styles={{
          goalActions: {},
          teamGoalControls: {},
          scoreControlRow: {},
          actionButton: {},
          blueButton: {},
          goalCounter: {},
          goalValue: {},
        } as never}
      />,
    );
    const buttons = [
      renderer.root.findByProps({ testID: "ManualScoreDecrement-match-1-home" }),
      renderer.root.findByProps({ testID: "ManualScoreIncrement-match-1-home" }),
      renderer.root.findByProps({ testID: "ManualScoreDecrement-match-1-away" }),
      renderer.root.findByProps({ testID: "ManualScoreIncrement-match-1-away" }),
    ];

    expect(buttons.every((button) => button.props.disabled === true)).toBe(true);
    buttons.forEach((button) => button.props.onPress());
    expect(increment).not.toHaveBeenCalled();
    expect(decrement).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });
});
