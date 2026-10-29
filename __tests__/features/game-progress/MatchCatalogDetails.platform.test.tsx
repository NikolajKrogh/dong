import React from "react";
import { Text } from "react-native";
import { actCreate } from "../../../test-utils/render";
import { StatProgressBar } from "../../../features/game-progress/MatchQuickActionsModal/StatProgressBar";
import { PossessionCircle } from "../../../features/game-progress/MatchQuickActionsModal/PossessionCircle";
import { GoalScorersSection } from "../../../features/game-progress/MatchQuickActionsModal/GoalScorersSection";
import MatchesHeader from "../../../features/game-progress/MatchesGrid/MatchesHeader";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

// Pure rendering of nullable contracts; no authored device interaction or journey.
describe("saved match detail uncertainty", () => {
  it("keeps a healthy header quiet and shows a nonblocking source notice only when supplied", () => {
    const props = { sortField: "homeTeam" as const, sortDirection: "asc" as const, useGridLayout: false, setSortModalVisible: jest.fn(), toggleLayoutMode: jest.fn() };
    const healthy = actCreate(<MatchesHeader {...props} />);
    expect(healthy.root.findAllByType(Text).map(text => text.props.children)).toEqual(["Matches"]);
    const message = "Live scores are delayed. Saved scores are shown.";
    const stale = actCreate(<MatchesHeader {...props} sourceStatusMessage={message} />);
    expect(stale.root.findAllByType(Text).map(text => text.props.children)).toEqual(["Matches", message]);
    expect(stale.root.findByProps({ accessibilityLiveRegion: "polite" })).toBeDefined();
  });
  it("shows unknown counts as unavailable while preserving an established zero", () => {
    const renderer = actCreate(<StatProgressBar homeValue={null} awayValue={0} label="Fouls" />);
    const values = renderer.root.findAllByType(Text).map(text => text.props.children);
    expect(values).toContain("–");
    expect(values).toContain("0");
    expect(renderer.root.findByProps({ accessibilityLabel: "Fouls: Home unavailable, Away 0" })).toBeDefined();
  });
  it("does not draw a possession claim for a missing side", () => {
    const renderer = actCreate(<PossessionCircle homeValue={null} awayValue={56} />);
    const values = renderer.root.findAllByType(Text).map(text => text.props.children);
    expect(values).toContain("–");
    expect(values).toContain("56%");
    expect(values).not.toContain("0%");
  });
  it("distinguishes missing goal details from a complete empty list", () => {
    const missing = actCreate(<GoalScorersSection homeTeamScorers={[]} awayTeamScorers={[]} availability="unavailable" styles={{} as never} />);
    expect(missing.root.findAllByType(Text).map(text => text.props.children)).toContain("Goal details unavailable");
    const complete = actCreate(<GoalScorersSection homeTeamScorers={[]} awayTeamScorers={[]} availability="available" styles={{} as never} />);
    expect(complete.root.findAllByType(Text)).toHaveLength(0);
  });
});
