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

// PlatformDatePicker wraps react-native-date-picker, whose native module throws
// `new NativeEventEmitter() requires a non-null argument` under Jest. Stubbed to a
// host tag (same approach as MatchFilter's suite) while the real date<->ISO helpers
// pass through, so the date the component sends as `requestedAt` is still the
// genuinely computed value rather than a mock's.
jest.mock("../../../platform", () => ({
  PlatformDatePicker: "PlatformDatePicker",
  formatDateIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).formatDateIsoValue,
  parseDateIsoValue: jest.requireActual(
    "../../../platform/date-input/normalizeValue",
  ).parseDateIsoValue,
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

  /**
   * The request previously omitted `requestedAt` entirely, which pins discovery to
   * today — so during an off-season gap the modal was empty with no way to reach
   * another date.
   */
  it("asks for a specific date rather than letting the server default to today", async () => {
    const discoverMatches = jest.fn(async () => []);
    mockGetMatchDiscoveryApiClient.mockReturnValue({ discoverMatches } as never);

    const { renderer } = render();
    await TestRenderer.act(async () => {
      await flush();
    });

    expect(discoverMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        leagueCodes: ["eng.1"],
        requestedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/),
      }),
    );
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("refetches for the newly chosen date when the host changes it", async () => {
    const discoverMatches = jest.fn(async () => []);
    mockGetMatchDiscoveryApiClient.mockReturnValue({ discoverMatches } as never);

    const { renderer } = render();
    await TestRenderer.act(async () => {
      await flush();
    });
    discoverMatches.mockClear();

    const picker = renderer.root.findByType("PlatformDatePicker" as never);
    await TestRenderer.act(async () => {
      (picker.props.onConfirm as (d: Date) => void)(new Date("2026-08-22T12:00:00Z"));
      await flush();
    });

    expect(discoverMatches).toHaveBeenCalledWith(
      expect.objectContaining({ requestedAt: "2026-08-22T00:00:00.000Z" }),
    );
    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

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
