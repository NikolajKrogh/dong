import React from "react";
import { act } from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";
import { GameSession } from "../../../components/history/historyTypes";
import { calculateLifetimePlayerStats } from "../../../components/history/historyUtils";

let mockLayout = { contentWidth: 800, fontScale: 1, isDesktop: true };
jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: (options: Record<string, unknown>) => options.web ?? options.default,
  },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
}));
jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    primary: "blue",
    secondary: "gray",
    textMuted: "gray",
    textSecondary: "black",
    surface: "white",
    backgroundLight: "white",
    border: "gray",
    textPrimary: "black",
    primaryLight: "lightblue",
  }),
}));
jest.mock("../../../components/history/HistoryModalFrame", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: {
    children: (layout: typeof mockLayout) => React.ReactNode;
  }) => require("react").createElement("Frame", props, children(mockLayout)),
}));
jest.mock("../../../components/history/TooltipModal", () => ({
  __esModule: true,
  default: (props: object) => require("react").createElement("Tooltip", props),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const PlayerComparisonModal =
  require("../../../components/history/PlayerComparisonModal").default;
const game = (
  id: string,
  date: string,
  players: GameSession["players"],
): GameSession => ({
  id,
  date,
  players,
  matches: [
    { id: "m", homeTeam: "Home", awayTeam: "Away", homeGoals: 0, awayGoals: 0 },
  ],
  commonMatchId: null,
  playerAssignments: {},
  matchesPerPlayer: 1,
});
const participant = (accountId: string, name: string, drinksTaken: number) => ({
  id: accountId,
  accountId,
  name,
  drinksTaken,
  membershipType: "registered" as const,
});
const history = [
  game("1", "2026-01-01", [
    participant("a", "Old name", 2),
    participant("b", "Same name", 4),
  ]),
  game("2", "2026-01-02", [
    participant("a", "Same name", 0),
    participant("b", "Same name", 0),
  ]),
  game("3", "2026-01-03", [participant("a", "Same name", 0)]),
];
function render(games = history, onClose = jest.fn()) {
  const players = calculateLifetimePlayerStats(games);
  return actCreate(
    <PlayerComparisonModal
      visible
      onClose={onClose}
      player1={players.find((p) => p.identityKey.includes('"a"'))}
      player2={players.find((p) => p.identityKey.includes('"b"'))}
      gameHistory={games}
    />,
  );
}
const text = (renderer: ReturnType<typeof actCreate>) =>
  JSON.stringify(renderer.toJSON());

describe("PlayerComparisonModal", () => {
  beforeEach(() => {
    mockLayout = { contentWidth: 800, fontScale: 1, isDesktop: true };
  });
  it("keeps same-name accounts separate and includes renamed appearances on the correct sides", () => {
    const renderer = render();
    expect(
      renderer.root.findByProps({ testID: "Total drinks-value-0" }).props
        .children,
    ).toBe("2.0");
    expect(
      renderer.root.findByProps({ testID: "Total drinks-value-1" }).props
        .children,
    ).toBe("4.0");
    expect(
      renderer.root.findByProps({ testID: "Higher drink total-value-0" }).props
        .children,
    ).toBe("0");
    expect(
      renderer.root.findByProps({ testID: "Higher drink total-value-1" }).props
        .children,
    ).toBe("1");
    expect(text(renderer)).toContain("2 games together · 1 tie");
    expect(text(renderer)).not.toContain("Drinking Influence");
    expect(text(renderer)).not.toContain('"Wins"');
  });
  it("scales bars per pair and renders empty zero bars", () => {
    const renderer = render();
    expect(
      renderer.root.findByProps({ testID: "Total drinks-bar-0" }).props.style
        .width,
    ).toBe("50%");
    expect(
      renderer.root.findByProps({ testID: "Total drinks-bar-1" }).props.style
        .width,
    ).toBe("100%");
    const zero = render([
      game("zero", "", [participant("a", "A", 0), participant("b", "B", 0)]),
    ]);
    expect(
      zero.root.findByProps({ testID: "Total drinks-bar-0" }).props.style.width,
    ).toBe("0%");
  });
  it.each([
    { contentWidth: 350, fontScale: 1, isDesktop: false },
    { contentWidth: 900, fontScale: 1.5, isDesktop: false },
  ])("hides decorative bars without shrinking labels: %j", (layout) => {
    mockLayout = layout;
    const renderer = render();
    expect(
      renderer.root.findAllByProps({ testID: "Total drinks-bar-0" }),
    ).toHaveLength(0);
    expect(
      renderer.root.findByProps({ testID: "Total drinks-value-0" }).props
        .style[0].fontSize,
    ).toBe(20);
  });
  it("distinguishes a real zero average from missing separate games", () => {
    const renderer = render();
    const first = renderer.root.findByProps({
      testID: "comparison-averages-0",
    });
    const second = renderer.root.findByProps({
      testID: "comparison-averages-1",
    });
    expect(
      JSON.stringify(
        first
          .findAllByType("Text" as React.ElementType)
          .map((n) => n.props.children),
      ),
    ).toContain("0.0 · 1 game");
    expect(
      JSON.stringify(
        second
          .findAllByType("Text" as React.ElementType)
          .map((n) => n.props.children),
      ),
    ).toContain("No other games");
  });
  it("shows no shared games while retaining actual zero averages", () => {
    const renderer = render([
      game("a", "", [participant("a", "A", 0)]),
      game("b", "", [participant("b", "B", 0)]),
    ]);
    expect(text(renderer)).toContain("No games together");
    expect(text(renderer)).toContain("0.0 · 1 game");
  });
  it("keeps full long names and context, and delegates dismissal to the shared frame", () => {
    const onClose = jest.fn();
    const name =
      "A very long name that must remain available in the comparison";
    const renderer = render(
      [game("g", "", [participant("a", name, 0), participant("b", name, 0)])],
      onClose,
    );
    expect(text(renderer)).toContain(name);
    const frame = renderer.root.findByType("Frame" as React.ElementType);
    expect(frame.props.closeLabel).toBe("Close player comparison");
    act(() => frame.props.onClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("opens denominator tooltips", () => {
    const renderer = render();
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: "About drinks per match" })
        .props.onPress(),
    );
    const tooltip = renderer.root
      .findAllByType("Tooltip" as React.ElementType)
      .find((n) => n.props.title === "Drinks per match")!;
    expect(tooltip.props.visible).toBe(true);
    expect(tooltip.props.description).toContain(
      "including matches not assigned",
    );
  });
  it("returns null if a player is absent", () => {
    const renderer = actCreate(
      <PlayerComparisonModal
        visible
        onClose={jest.fn()}
        player1={null}
        player2={null}
        gameHistory={[]}
      />,
    );
    expect(renderer.toJSON()).toBeNull();
  });
});
