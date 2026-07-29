import React from "react";
import { actCreate } from "../../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockBack = jest.fn();

const mockSnapshot: {
  matches: {
    id: string;
    sourceProvider: string;
    sourceMatchId: string | null;
    homeTeamName: string;
    awayTeamName: string;
    kickoffAt: string | null;
    homeScore: number;
    awayScore: number;
  }[];
} = { matches: [] };

const mockConfigure = {
  isBusy: false,
  error: null as string | null,
  addMatch: jest.fn(async () => {}),
  removeMatch: jest.fn(async () => {}),
};

jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: (o: Record<string, unknown>) => o.web ?? o.default,
  },
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  TouchableOpacity: "TouchableOpacity",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({
    sessionId: "room-1",
    participantId: "p1",
  }),
}));

jest.mock("tamagui", () => ({ Text: "TamaguiText" }));

jest.mock("../../../components/AppIcon", () => "AppIcon");

jest.mock("../../../components/ui", () => ({
  ShellScreen: ({ children, ...props }: Record<string, unknown>) => {
    const ReactLocal = require("react");
    return ReactLocal.createElement(
      "ShellScreen",
      { testID: "ShellScreen", ...props },
      children as React.ReactNode,
    );
  },
}));

jest.mock("../../../components/setupGame/MatchList", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const ReactLocal = require("react");
    return ReactLocal.createElement("MatchList", {
      testID: "MatchList",
      ...props,
    });
  },
}));

jest.mock("../../../hooks/useRoomLobby", () => ({
  useRoomLobby: () => ({ snapshot: mockSnapshot, refresh: jest.fn() }),
}));

jest.mock("../../../hooks/useRoomConfigure", () => ({
  useRoomConfigure: () => mockConfigure,
}));

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({ textLight: "#fff", primary: "#p" }),
}));

const mockStyles = {
  wizardContainer: { testStyle: "wizardContainer" },
  wizardWideLayout: { testStyle: "wizardWideLayout" },
  wizardMainPanel: { testStyle: "wizardMainPanel" },
  stepContentScroll: { testStyle: "stepContentScroll" },
  wizardNavigation: { testStyle: "wizardNavigation" },
  wizardNavigationWide: { testStyle: "wizardNavigationWide" },
  navButton: { testStyle: "navButton" },
  navButtonWide: { testStyle: "navButtonWide" },
  navButtonText: { testStyle: "navButtonText" },
};

jest.mock("../../../styles/setupGameStyles", () => ({
  __esModule: true,
  default: () => mockStyles,
}));

const render = () => {
  const Screen =
    require("../../../app/lobby/configureMatches").default;
  return actCreate(React.createElement(Screen));
};

/**
 * The room's match-selection screen. Its job is to present the wizard's matches
 * step against a room's server-owned pool while looking like a wizard step —
 * which is what these assertions pin, since the visual half of that (a bordered
 * panel, a bottom nav bar) is otherwise only checkable by eye.
 */
describe("configureMatches screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot.matches = [];
    mockConfigure.isBusy = false;
    mockConfigure.error = null;
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("wraps the content in the wizard's panel and scroll region", () => {
    const renderer = render();

    expect(
      renderer.root.findAllByProps({ style: mockStyles.wizardMainPanel }),
    ).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ style: mockStyles.stepContentScroll }),
    ).toHaveLength(1);
  });

  it("renders a wizard-style bottom navigation bar with Back and Done", () => {
    const renderer = render();

    expect(
      renderer.root.findAllByProps({
        testID: "configure-room-matches-navigation",
      }),
    ).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ testID: "configure-room-matches-back" }),
    ).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ testID: "configure-room-matches-done" }),
    ).toHaveLength(1);
  });

  it.each([
    ["configure-room-matches-back"],
    ["configure-room-matches-done"],
  ])("returns to the lobby from %s", (testID) => {
    const renderer = render();

    renderer.root.findByProps({ testID }).props.onPress();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  /**
   * The screen owns the heading, so MatchList's own must be suppressed — leaving
   * both on stacked two titles from two different type systems.
   */
  it("supplies the only heading", () => {
    const renderer = render();

    expect(
      renderer.root.findAllByProps({ testID: "configure-room-matches-title" }),
    ).toHaveLength(1);
    expect(
      renderer.root.findByProps({ testID: "MatchList" }).props.showSectionTitle,
    ).toBe(false);
  });

  // Releasing a match here is a server round-trip, unlike the solo flow.
  it.each([
    [true, true],
    [false, false],
  ])("passes isBusy=%s through as disableSelection", (isBusy, expected) => {
    mockConfigure.isBusy = isBusy;
    const renderer = render();

    expect(
      renderer.root.findByProps({ testID: "MatchList" }).props.disableSelection,
    ).toBe(expected);
  });

  it("surfaces a mutation error", () => {
    mockConfigure.error = "Something went wrong. Please try again.";
    const renderer = render();

    expect(
      renderer.root.findByProps({ testID: "configure-room-matches-error" })
        .props.children,
    ).toBe("Something went wrong. Please try again.");
  });

  it("hides the error line when there is nothing to report", () => {
    const renderer = render();

    expect(
      renderer.root.findAllByProps({ testID: "configure-room-matches-error" }),
    ).toHaveLength(0);
  });

  // Mirrors app/setupGame.tsx, which the room screen previously did not do at all
  // — content stretched edge to edge on a desktop viewport.
  describe("wide layouts", () => {
    it("centres and caps content width past the wide breakpoint", () => {
      mockUseWindowDimensions.mockReturnValue({
        width: 1280,
        height: 800,
        scale: 1,
        fontScale: 1,
      });
      const shell = render().root.findByProps({ testID: "ShellScreen" });

      expect(shell.props.centerContent).toBe(true);
      expect(shell.props.contentMaxWidth).toBe(1120);
    });

    it("leaves both off on a phone", () => {
      const shell = render().root.findByProps({ testID: "ShellScreen" });

      expect(shell.props.centerContent).toBe(false);
      expect(shell.props.contentMaxWidth).toBeUndefined();
    });
  });
});
