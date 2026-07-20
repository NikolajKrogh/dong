import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import TestRenderer from "react-test-renderer";

import { ConfigureMatchesModal } from "../../../components/lobby/ConfigureMatchesModal";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import { getMatchDiscoveryApiClient } from "../../../utils/commandApiClient";

// The mocked selector's state MUST be a stable, module-level reference — a fresh
// array literal per call would make `configuredLeagues` change identity on every
// render, retriggering the component's fetch effect forever (an infinite loop
// that isn't a problem with a real Zustand store, which does keep it stable).
const STABLE_CONFIGURED_LEAGUES = [{ code: "eng.1", name: "Premier League" }];

jest.mock("../../../store/store", () => ({
  useGameStore: jest.fn((selector: (state: unknown) => unknown) =>
    selector({ configuredLeagues: STABLE_CONFIGURED_LEAGUES }),
  ),
}));

jest.mock("../../../utils/commandApiClient", () => ({
  getMatchDiscoveryApiClient: jest.fn(),
}));

const mockGetMatchDiscoveryApiClient = jest.mocked(getMatchDiscoveryApiClient);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const render = (props: Partial<React.ComponentProps<typeof ConfigureMatchesModal>> = {}) => {
  const onAdd = jest.fn();
  const onClose = jest.fn();
  const renderer = TestRenderer.create(
    React.createElement(
      TamaguiTestProvider,
      null,
      React.createElement(ConfigureMatchesModal, {
        visible: true,
        selectedMatches: [],
        onAdd,
        onClose,
        ...props,
      }),
    ),
  );
  return { renderer, onAdd, onClose };
};

describe("ConfigureMatchesModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders fetched fixtures and adds one on tap", async () => {
    const discoverMatches = jest.fn(async () => [
      {
        id: "espn-1",
        league: "eng.1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startDateTime: "2026-01-01T15:00:00.000Z",
        status: "scheduled" as const,
      },
    ]);
    mockGetMatchDiscoveryApiClient.mockReturnValue({ discoverMatches } as never);

    const { renderer, onAdd } = render();
    await TestRenderer.act(async () => {
      await flush();
    });

    const addButton = renderer.root.findByProps({
      testID: "configure-match-add-espn-1",
    });
    TestRenderer.act(() => {
      (addButton.props.onPress as () => void)();
    });

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProvider: "espn",
        sourceMatchId: "espn-1",
        homeTeamName: "Arsenal",
        awayTeamName: "Chelsea",
      }),
    );
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("disables the add button for a fixture already in the room", async () => {
    const discoverMatches = jest.fn(async () => [
      {
        id: "espn-1",
        league: "eng.1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        startDateTime: "2026-01-01T15:00:00.000Z",
        status: "scheduled" as const,
      },
    ]);
    mockGetMatchDiscoveryApiClient.mockReturnValue({ discoverMatches } as never);

    const { renderer } = render({
      selectedMatches: [
        {
          id: "room-match-1",
          sourceProvider: "espn",
          sourceMatchId: "espn-1",
          homeTeamName: "Arsenal",
          awayTeamName: "Chelsea",
          kickoffAt: null,
          homeScore: 0,
          awayScore: 0,
        },
      ],
    });
    await TestRenderer.act(async () => {
      await flush();
    });

    const addButton = renderer.root.findByProps({
      testID: "configure-match-add-espn-1",
    });
    expect(addButton.props.disabled).toBe(true);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("shows an error message when the catalog fails to load", async () => {
    const discoverMatches = jest.fn(async () => {
      throw new Error("Match discovery is temporarily unavailable.");
    });
    mockGetMatchDiscoveryApiClient.mockReturnValue({ discoverMatches } as never);

    const { renderer } = render();
    await TestRenderer.act(async () => {
      await flush();
    });

    const error = renderer.root.findByProps({ testID: "configure-matches-error" });
    expect(error.props.children).toBe("Match discovery is temporarily unavailable.");
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("calls onClose when Done is pressed", async () => {
    mockGetMatchDiscoveryApiClient.mockReturnValue({
      discoverMatches: jest.fn(async () => []),
    } as never);

    const { renderer, onClose } = render();
    await TestRenderer.act(async () => {
      await flush();
    });

    const closeButton = renderer.root.findByProps({ testID: "configure-matches-close" });
    TestRenderer.act(() => {
      (closeButton.props.onPress as () => void)();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
