import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";
import { GameSession } from "../../../components/history/historyTypes";

jest.mock("react-native", () => ({
  Image: "Image",
  Platform: { OS: "web", select: (options: Record<string, unknown>) => options.web ?? options.default },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    backgroundLight: "#f8f9fa",
    borderSubtle: "#e9ecef",
    primary: "#0275d8",
    primaryLight: "#e3f2fd",
    surface: "#ffffff",
    textMuted: "#6c757d",
    textPrimary: "#212529",
    textSecondary: "#333333",
    warning: "#ffc107",
  }),
}));

jest.mock("../../../components/AppIcon", () => {
  const MockAppIcon = () => null;
  return { __esModule: true, AppIcon: MockAppIcon, default: MockAppIcon };
});

jest.mock("../../../components/history/HistoryTeamBadge", () => ({
  __esModule: true,
  default: () => null,
}));

const makeGame = (overrides: Partial<GameSession> = {}): GameSession => ({
  id: "game-1",
  date: "2026-09-27T10:00:00.000Z",
  players: [{ id: "p1", name: "Alice", drinksTaken: 2 }],
  matches: [
    {
      id: "match-1",
      homeTeam: "Alpha United",
      awayTeam: "Beta City",
      homeGoals: 2,
      awayGoals: 1,
    },
  ],
  commonMatchId: "missing-common-match",
  playerAssignments: {},
  matchesPerPlayer: 1,
  ...overrides,
});

const renderGame = (game: GameSession, onDetailsPress = jest.fn()) => {
  const GameHistoryItem =
    require("../../../components/history/GameHistoryItem").default;
  const renderer = actCreate(
    React.createElement(GameHistoryItem, { game, onDetailsPress }),
  );
  return { renderer, onDetailsPress };
};

const getRenderedText = (renderer: TestRenderer.ReactTestRenderer): string =>
  renderer.root
    .findAllByType("Text" as React.ElementType)
    .map((node) => {
      const children = node.props.children;
      const parts = Array.isArray(children) ? children : [children];
      return parts
        .map((part) =>
          typeof part === "string" || typeof part === "number" ? String(part) : "",
        )
        .join("");
    })
    .join(" ");

describe("GameHistoryItem", () => {
  it("falls back to the first match and opens details from the whole card", () => {
    const game = makeGame({
      matches: [
        {
          id: "first",
          homeTeam: "First Home",
          awayTeam: "First Away",
          homeGoals: 3,
          awayGoals: 2,
        },
        {
          id: "second",
          homeTeam: "Second Home",
          awayTeam: "Second Away",
          homeGoals: 0,
          awayGoals: 0,
        },
      ],
    });
    const { renderer, onDetailsPress } = renderGame(game);
    const content = JSON.stringify(renderer.toJSON());

    expect(content).toContain("First Home");
    expect(content).toContain("First Away");
    expect(content).toContain("3");
    expect(content).toContain("View details · 1 more match");
    expect(content).not.toContain("Second Home");
    expect(renderer.root.findAllByType("TouchableOpacity" as React.ElementType)).toHaveLength(1);

    const card = renderer.root.findByProps({ testID: "HistoryGameItem-game-1" });
    TestRenderer.act(() => card.props.onPress());
    expect(onDetailsPress).toHaveBeenCalledWith(game);
  });

  it("omits a match preview when there are no matches", () => {
    const game = makeGame({ matches: [], commonMatchId: null, matchesPerPlayer: 0 });
    const { renderer } = renderGame(game);
    const content = JSON.stringify(renderer.toJSON());

    expect(content).not.toContain("Match preview");
    expect(content).not.toContain("HistoryMatchCard-");
    expect(content).toContain("View details");
  });

  it("shows two player chips with overflow and a tied top summary for long names", () => {
    const game = makeGame({
      players: [
        { id: "p1", name: "Alexandria Longname Player One", drinksTaken: 12 },
        { id: "p2", name: "Alexandria Longname Player Two", drinksTaken: 12 },
        { id: "p3", name: "Alexandria Longname Player Three", drinksTaken: 12 },
        ...Array.from({ length: 9 }, (_, index) => ({
          id: `p${index + 4}`,
          name: `Player ${index + 4}`,
          drinksTaken: 1,
        })),
      ],
    });
    const { renderer } = renderGame(game);
    const content = JSON.stringify(renderer.toJSON());
    const renderedText = getRenderedText(renderer);
    const card = renderer.root.findByProps({ testID: "HistoryGameItem-game-1" });

    expect(content).toContain("Alexandria Longname Player One");
    expect(content).toContain("Alexandria Longname Player Two");
    expect(renderedText).toContain("+10");
    expect(content).toContain("Tied top drinkers");
    expect(renderedText).toContain("+1");
    expect(card.props.accessibilityLabel).toContain("Alexandria Longname Player One");
    expect(card.props.accessibilityLabel).toContain("Alpha United 2 to 1 Beta City");
    expect(card.props.accessibilityLabel).toContain("drinks each");
    expect(
      renderer.root
        .findAllByType("Text" as React.ElementType)
        .find((node) => node.props.children === "Alexandria Longname Player One")
        ?.props.numberOfLines,
    ).toBe(1);
  });
});
