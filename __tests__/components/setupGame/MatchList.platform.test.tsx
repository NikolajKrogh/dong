import React from "react";
import TestRenderer from "react-test-renderer";

const mockPlatformAnimation = jest.fn(() => null);
const mockMatchTeamsData: unknown[] = [];
const mockApiData: unknown[] = [];
const mockAvailableLeagues: unknown[] = [];
const mockAllTeamsData: unknown[] = [];
const mockFilteredTeamsData: unknown[] = [];
const mockSetFilteredTeamsData = jest.fn();

jest.mock("../../../platform", () => ({
  PlatformAnimation: mockPlatformAnimation,
  formatDateIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).formatDateIsoValue,
}));

jest.mock("../../../store/store", () => ({
  useGameStore: () => ({
    defaultSelectedLeagues: [],
    theme: "light",
  }),
}));

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#123456",
  }),
}));

jest.mock("../../../app/style/setupGameStyles", () => ({
  __esModule: true,
  default: () =>
    new Proxy(
      {},
      {
        get: () => ({}),
      },
    ),
}));

jest.mock("../../../hooks/useMatchData", () => ({
  useMatchData: () => ({
    isLoading: true,
    isError: false,
    errorMessage: "",
    teamsData: mockMatchTeamsData,
    apiData: mockApiData,
    availableLeagues: mockAvailableLeagues,
  }),
}));

jest.mock("../../../hooks/useTeamData", () => ({
  useTeamData: () => ({
    isLoading: false,
    isError: false,
    errorMessage: "",
    teamsData: mockAllTeamsData,
  }),
}));

jest.mock("../../../hooks/useTeamFiltering", () => ({
  useTeamFiltering: () => ({
    filteredTeamsData: mockFilteredTeamsData,
    setFilteredTeamsData: mockSetFilteredTeamsData,
  }),
  filterMatchesByDateAndTime: jest.fn((matches) => matches),
}));

jest.mock("../../../hooks/useMatchProcessing", () => ({
  useMatchProcessing: () => ({
    startProcessing: jest.fn(),
    processingState: {
      isProcessing: false,
      matchesAdded: 0,
      matchesSkipped: 0,
    },
  }),
}));

jest.mock("../../../components/setupGame/MatchFilter", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../../components/setupGame/TeamSelectionRow", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../../components/setupGame/MatchItem", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../../components/setupGame/LeagueFilter", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("MatchList platform adoption", () => {
  it("uses the shared animation adapter for loading feedback", () => {
    const MatchList =
      require("../../../components/setupGame/MatchList").default;
    let renderer: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        React.createElement(MatchList, {
          matches: [],
          homeTeam: "",
          awayTeam: "",
          setHomeTeam: jest.fn(),
          setAwayTeam: jest.fn(),
          handleAddMatch: jest.fn(),
          handleRemoveMatch: jest.fn(),
        }),
      );
    });

    expect(mockPlatformAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "loading" }),
      {},
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
