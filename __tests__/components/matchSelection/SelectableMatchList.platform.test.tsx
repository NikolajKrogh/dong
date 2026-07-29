import React from "react";
import { actCreate } from "../../../test-utils/render";

const mockStyles = {
  gridContainer: { testStyle: "gridContainer" },
  gridItem: { testStyle: "gridItem" },
  compactMatchItem: { testStyle: "compactMatchItem" },
  selectedCompactMatchItem: { testStyle: "selectedCompactMatchItem" },
  compactMatchNumberBadge: { testStyle: "compactMatchNumberBadge" },
  compactMatchNumberText: { testStyle: "compactMatchNumberText" },
  compactTeamsContainer: { testStyle: "compactTeamsContainer" },
  compactTeamLogo: { testStyle: "compactTeamLogo" },
  compactTeamPlaceholder: { testStyle: "compactTeamPlaceholder" },
  compactTeamPlaceholderText: { testStyle: "compactTeamPlaceholderText" },
  compactVsText: { testStyle: "compactVsText" },
  matchCard: { testStyle: "matchCard" },
  selectedMatchCard: { testStyle: "selectedMatchCard" },
  matchListItem: { testStyle: "matchListItem" },
  matchNumberBadge: { testStyle: "matchNumberBadge" },
  matchNumberText: { testStyle: "matchNumberText" },
  matchCardGradient: { testStyle: "matchCardGradient" },
  matchTeamsContainer: { testStyle: "matchTeamsContainer" },
  matchTeamColumn: { testStyle: "matchTeamColumn" },
  logoContainer: { testStyle: "logoContainer" },
  teamLogo: { testStyle: "teamLogo" },
  teamLogoPlaceholder: { testStyle: "teamLogoPlaceholder" },
  teamLogoPlaceholderText: { testStyle: "teamLogoPlaceholderText" },
  teamName: { testStyle: "teamName" },
  vsDividerHorizontal: { testStyle: "vsDividerHorizontal" },
  vsText: { testStyle: "vsText" },
  selectionCheckmark: { testStyle: "selectionCheckmark" },
  // Added when the kickoff footer moved in from the wizard's old match card.
  matchTimeHeader: { testStyle: "matchTimeHeader" },
  matchTimeText: { testStyle: "matchTimeText" },
};

jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: (o: Record<string, unknown>) => o.web ?? o.default,
  },
  View: "View",
  Text: "Text",
  FlatList: "FlatList",
  TouchableOpacity: "TouchableOpacity",
  Image: "Image",
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("../../../components/AppIcon", () => "AppIcon");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "#p",
    primaryLighter: "#pl",
    surface: "#s",
    border: "#b",
  }),
}));

jest.mock("../../../styles/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

jest.mock("../../../utils/teamLogos", () => ({
  getTeamLogoWithFallback: () => null,
}));

const MATCHES = [
  { id: "m1", homeTeam: "Arsenal", awayTeam: "Chelsea" },
  { id: "m2", homeTeam: "Liverpool", awayTeam: "Spurs" },
  { id: "m3", homeTeam: "Leeds", awayTeam: "Villa" },
];

const render = (props: Record<string, unknown> = {}) => {
  const {
    SelectableMatchList,
  } = require("../../../components/matchSelection/SelectableMatchList");

  return actCreate(
    React.createElement(SelectableMatchList, {
      matches: MATCHES,
      selectedMatchIds: [],
      onToggleMatch: jest.fn(),
      testIDPrefix: "pick",
      ...props,
    }),
  );
};

describe("SelectableMatchList", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports the tapped match id back to the caller", () => {
    const onToggleMatch = jest.fn();
    const renderer = render({ onToggleMatch, useGridLayout: true });

    renderer.root.findByProps({ testID: "pick-m2" }).props.onPress();

    expect(onToggleMatch).toHaveBeenCalledWith("m2");
  });

  it("marks selected matches as selected", () => {
    const renderer = render({
      selectedMatchIds: ["m2"],
      useGridLayout: true,
    });

    expect(
      renderer.root.findByProps({ testID: "pick-m2" }).props
        .accessibilityState,
    ).toEqual({ selected: true, disabled: false });
    expect(
      renderer.root.findByProps({ testID: "pick-m1" }).props
        .accessibilityState,
    ).toEqual({ selected: false, disabled: false });
  });

  // The cap case (FR-040): at the limit, unpicked matches go inert while the
  // picked ones stay tappable, so a participant can always release one.
  it("disables only the matches named in disabledMatchIds", () => {
    const renderer = render({
      selectedMatchIds: ["m1"],
      disabledMatchIds: ["m2", "m3"],
      useGridLayout: true,
    });

    expect(
      renderer.root.findByProps({ testID: "pick-m2" }).props.disabled,
    ).toBe(true);
    expect(
      renderer.root.findByProps({ testID: "pick-m1" }).props.disabled,
    ).toBe(false);
  });

  it("renders a grid when asked and a list otherwise", () => {
    // Asserted through the grid container style rather than findAllByType, since
    // react-native is string-mocked in this suite and the element types aren't
    // real components.
    const grid = render({ useGridLayout: true });
    expect(
      grid.root.findAllByProps({ style: mockStyles.gridContainer }).length,
    ).toBeGreaterThan(0);
    expect(
      grid.root.findAllByProps({ style: mockStyles.gridItem }).length,
    ).toBeGreaterThan(0);

    const list = render({ useGridLayout: false });
    expect(
      list.root.findAllByProps({ style: mockStyles.gridContainer }),
    ).toHaveLength(0);
  });

  it("omits per-match testIDs when no prefix is given", () => {
    const renderer = render({ testIDPrefix: undefined, useGridLayout: true });

    expect(renderer.root.findAllByProps({ testID: "pick-m1" })).toHaveLength(0);
  });
  /**
   * The kickoff footer arrived here when the wizard and the multiplayer room
   * converged on this renderer. Both `startTime` shapes must work: a local
   * "HH:MM" from match discovery and a full ISO instant from a room's pool.
   *
   * Driven through the FlatList's `renderItem` rather than the rendered tree:
   * `react-native` is string-mocked in this suite, so the fake `FlatList` never
   * calls `renderItem` and list rows are otherwise unreachable.
   */
  describe("kickoff footer", () => {
    const renderRow = (match: Record<string, unknown>) => {
      const list = render({ matches: [match], useGridLayout: false });
      const { renderItem } = list.root.findByType("FlatList" as never).props;
      return actCreate(renderItem({ item: match, index: 0 }));
    };

    const footers = (row: ReturnType<typeof actCreate>) =>
      row.root.findAllByProps({ style: mockStyles.matchTimeHeader });

    it("renders for a match with a bare clock time", () => {
      const row = renderRow({
        id: "m1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startTime: "15:00",
      });

      expect(footers(row)).toHaveLength(1);
      expect(
        row.root.findByProps({ style: mockStyles.matchTimeText }).props.children,
      ).toBe("15:00");
    });

    it("renders for a match with a full ISO instant", () => {
      const row = renderRow({
        id: "m1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startTime: "2026-08-22T11:30:00.000Z",
      });

      expect(footers(row)).toHaveLength(1);
      expect(
        row.root.findByProps({ style: mockStyles.matchTimeText }).props.children,
      ).toMatch(/^\d{2}:\d{2} (AM|PM)$/);
    });

    // A hand-typed fixture has no kickoff; it must not leave an empty row.
    it("is omitted entirely when the match has no startTime", () => {
      const row = renderRow({ id: "m1", homeTeam: "Arsenal", awayTeam: "Chelsea" });

      expect(footers(row)).toHaveLength(0);
    });

    // The 3-up grid has no room for it, and AssignmentSection relies on that density.
    it("never renders in grid mode", () => {
      const grid = render({
        useGridLayout: true,
        matches: [
          { id: "m1", homeTeam: "Arsenal", awayTeam: "Chelsea", startTime: "15:00" },
        ],
      });

      expect(
        grid.root.findAllByProps({ style: mockStyles.matchTimeHeader }),
      ).toHaveLength(0);
    });
  });
});
