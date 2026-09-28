import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

const mockDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }));
jest.mock("react-native", () => new Proxy({
  View: "View", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles, flatten: (style: unknown) => style },
  useWindowDimensions: () => mockDimensions(),
  FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ...props }: any) =>
    require("react").createElement("FlatList", props, ListHeaderComponent,
      data.length ? data.map((item: any, index: number) =>
        require("react").createElement(require("react").Fragment, { key: item.player.identityKey }, renderItem({ item, index })))
        : ListEmptyComponent),
}, { get: (target, key) => key in target ? target[key as keyof typeof target] : jest.requireActual("react-native")[key] }));
jest.mock("tamagui", () => ({ ...jest.requireActual("tamagui"), Text: "Text" }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("../../../styles/theme", () => ({
  lightColors: require("../../../styles/palette").colors,
  darkColors: require("../../../styles/palette").colors,
  useColors: () => ({ surface: "#fff", primary: "#0275d8", primaryLight: "#e3f2fd", textPrimary: "#111", textMuted: "#666", border: "#ddd", backgroundSubtle: "#eee" }),
}));
jest.mock("../../../components/history/PlayerDetailsModal", () => (props: unknown) =>
  require("react").createElement("PlayerDetailsModal", props as any));
jest.mock("../../../components/history/PlayerComparisonModal", () => (props: unknown) =>
  require("react").createElement("PlayerComparisonModal", props as any));

import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import PlayerStatsList from "../../../components/history/PlayerStatsList";
import OverallStats from "../../../components/history/OverallStats";
import { GameSession, PlayerStat } from "../../../components/history/historyTypes";

const render = (element: React.ReactElement) => actCreate(<TamaguiTestProvider>{element}</TamaguiTestProvider>);

const players: PlayerStat[] = [
  { identityKey: "account:a", contextLabel: null, name: "Alex", totalDrinks: 10, gamesPlayed: 2, averagePerGame: 5 },
  { identityKey: "guest:b", contextLabel: "Guest · second game", name: "Alex", totalDrinks: 4, gamesPlayed: 1, averagePerGame: 4 },
  { identityKey: "guest:c", contextLabel: null, name: "Casey", totalDrinks: 2, gamesPlayed: 1, averagePerGame: 2 },
];
const history: GameSession[] = [{
  id: "g1", date: "2026-09-27T12:00:00Z",
  players: [{ id: "a", accountId: "a", membershipType: "registered", name: "Alex", drinksTaken: 10 },
    { id: "b", name: "Casey", drinksTaken: 4 }],
  matches: [{ id: "m", homeTeam: "Home", awayTeam: "Away", homeGoals: 2, awayGoals: 1 }],
  commonMatchId: null, playerAssignments: {}, matchesPerPlayer: 0,
}];

beforeEach(() => mockDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 }));

it("keeps global ranking when searching and owns a scrolling list", () => {
  const renderer = render(<PlayerStatsList playerStats={players} history={[]} />);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Search players" }).props.onChangeText("Casey"));
  expect(renderer.root.findByProps({ accessibilityLabel: "Rank 3, Casey, 2.0 drinks" })).toBeTruthy();
  const list = renderer.root.findByType("FlatList" as any);
  expect(list.props.scrollEnabled).not.toBe(false);
  expect(renderer.root.findAllByType("ScrollView" as any)).toHaveLength(0);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Clear player search" }).props.onPress());
  expect(renderer.root.findByProps({ accessibilityLabel: "Search players" }).props.value).toBe("");
  expect(JSON.stringify(renderer.toJSON())).toContain("player entries");
});

it("compares distinct identities with identical names and preserves selection through search", () => {
  const renderer = render(<PlayerStatsList playerStats={players} history={[]} />);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Compare players" }).props.onPress());
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Rank 1, Alex, 10.0 drinks" }).props.onPress());
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Search players" }).props.onChangeText("second game"));
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Rank 2, Alex, Guest · second game, 4.0 drinks" }).props.onPress());
  const modal = renderer.root.findByType("PlayerComparisonModal" as any);
  expect(modal.props.player1.identityKey).toBe("account:a");
  expect(modal.props.player2.identityKey).toBe("guest:b");
});

it("keeps a selected identity through no-results search across twelve entries and clears it on cancel", () => {
  const manyPlayers = Array.from({ length: 12 }, (_, index) => ({
    identityKey: `account:${index}`, contextLabel: null, name: `Player ${index + 1}`,
    totalDrinks: 12 - index, gamesPlayed: 1, averagePerGame: 12 - index,
  }));
  const renderer = render(<PlayerStatsList playerStats={manyPlayers} history={[]} />);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Compare players" }).props.onPress());
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Rank 1, Player 1, 12.0 drinks" }).props.onPress());
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Search players" }).props.onChangeText("does not exist"));
  expect(JSON.stringify(renderer.toJSON())).toContain("No players match your search.");
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Clear player search" }).props.onPress());
  expect(renderer.root.findByProps({ accessibilityLabel: "Rank 1, Player 1, 12.0 drinks" }).props.accessibilityState.selected).toBe(true);
  expect(renderer.root.findAllByType("Pressable" as any).filter((node) => node.props.accessibilityLabel?.startsWith("Rank "))).toHaveLength(12);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Cancel comparison" }).props.onPress());
  expect(renderer.root.findByProps({ accessibilityLabel: "Rank 1, Player 1, 12.0 drinks" }).props.accessibilityState.selected).toBe(false);
});

it("uses available width and collapses player cards for larger text", () => {
  const renderer = render(<PlayerStatsList playerStats={players} history={[]} availableWidth={1100} />);
  expect(renderer.root.findByType("FlatList" as any).props.numColumns).toBe(2);
  expect(renderer.root.findByProps({ accessibilityLabel: "Rank 3, Casey, 2.0 drinks" }).props.style[1].maxWidth).toBe(526);
  mockDimensions.mockReturnValue({ width: 1200, height: 844, scale: 1, fontScale: 1.6 });
  TestRenderer.act(() => renderer.update(<TamaguiTestProvider><PlayerStatsList playerStats={players} history={[]} availableWidth={1100} /></TamaguiTestProvider>));
  expect(renderer.root.findByType("FlatList" as any).props.numColumns).toBe(1);
});

it("shows six participation-based metrics and opens existing game and player details", () => {
  const onGamePress = jest.fn();
  const renderer = render(<OverallStats history={history} onGamePress={onGamePress} availableWidth={1100} />);
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain("Player participations");
  expect(text).toContain("Avg. drinks per participation");
  expect(text).toContain('"7.0"');
  expect(text).toContain("Players who left early still count.");
  const slots = renderer.root.findAll((node) =>
    node.type === ("View" as React.ElementType) && Array.isArray(node.props.style) &&
    node.props.style.some((style: any) => style?.width === `${100 / 3}%`));
  expect(slots).toHaveLength(6);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "View most-goals game" }).props.onPress());
  expect(onGamePress).toHaveBeenCalledWith(history[0]);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "View top player Alex" }).props.onPress());
  expect(renderer.root.findByType("PlayerDetailsModal" as any).props.player.name).toBe("Alex");
  expect(renderer.root.findByType("PlayerDetailsModal" as any).props.player.identityKey).toBe(JSON.stringify(["account", "a"]));
});

it("counts repeated account appearances as participations rather than unique people", () => {
  const games = ["one", "two", "three"].map((id) => ({ ...history[0], id, players: [history[0].players[0]] }));
  const renderer = render(<OverallStats history={games} />);
  const participationLabel = renderer.root.find((node) => node.type === ("Text" as React.ElementType) && node.props.children === "Player participations");
  let tile = participationLabel.parent;
  while (tile && tile.type !== ("View" as React.ElementType)) tile = tile.parent;
  expect(tile?.findAllByType("Text" as React.ElementType).map((node) => node.props.children)).toContain("3");
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "View top player Alex" }).props.onPress());
  const selected = renderer.root.findByType("PlayerDetailsModal" as React.ElementType).props.player;
  expect(selected.gamesPlayed).toBe(3);
  expect(selected.totalDrinks).toBe(30);
});

it("shows tied highlight counts and chooses the same game regardless of input order", () => {
  const tied = { ...history[0], id: "g2", players: [{ id: "c", name: "Another", drinksTaken: 10 }] };
  const onGamePress = jest.fn();
  const renderer = render(<OverallStats history={[tied, history[0]]} onGamePress={onGamePress} />);
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain("games tied");
  expect(text).toContain("players tied");
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "View most-goals game" }).props.onPress());
  expect(onGamePress).toHaveBeenCalledWith(history[0]);
});

it.each([{ width: 390, fontScale: 1, tileWidth: "50%" }, { width: 320, fontScale: 1, tileWidth: "100%" }, { width: 1100, fontScale: 1.6, tileWidth: "100%" }])(
  "uses readable metric columns at width $width and font scale $fontScale",
  ({ width, fontScale, tileWidth }) => {
    mockDimensions.mockReturnValue({ width, height: 844, scale: 1, fontScale });
    const renderer = render(<OverallStats history={[]} />);
    const slots = renderer.root.findAll((node) => node.type === ("View" as React.ElementType) && Array.isArray(node.props.style) &&
      node.props.style.some((style: any) => style?.width === tileWidth));
    expect(slots).toHaveLength(6);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("NaN");
  },
);
