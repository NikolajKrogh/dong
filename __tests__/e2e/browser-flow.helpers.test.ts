import { type Page } from "@playwright/test";
import {
  HOME_READY_MARKERS,
  PERSISTED_STORE_KEY,
  buildPersistedBrowserStateFromSetupDataset,
  createSetupJourneyDataset,
  createSetupJourneyDatasets,
  dismissOnboardingIfPresent,
  waitForBrowserFlowReady,
} from "../../e2e/steps/browser-flow.helpers";

type MockLocator = {
  isVisible: jest.Mock<Promise<boolean>, [options?: { timeout?: number }] | []>;
  click: jest.Mock<Promise<void>, []>;
};

type MockPage = Pick<
  Page,
  "getByText" | "waitForLoadState" | "waitForFunction"
> & {
  getByText: jest.Mock<MockLocator, [string]>;
  waitForLoadState: jest.Mock<Promise<void>, ["networkidle"]>;
  waitForFunction: jest.Mock<
    Promise<void>,
    [unknown, readonly string[], { timeout: number }]
  >;
};

const createMockPage = (
  onboardingVisible = true,
): {
  page: MockPage;
  skipButton: MockLocator;
} => {
  const skipButton: MockLocator = {
    isVisible: jest.fn().mockResolvedValue(onboardingVisible),
    click: jest.fn().mockResolvedValue(undefined),
  };

  const page: MockPage = {
    getByText: jest.fn().mockReturnValue(skipButton),
    waitForLoadState: jest.fn().mockResolvedValue(undefined),
    waitForFunction: jest.fn().mockResolvedValue(undefined),
  };

  return { page, skipButton };
};

describe("browser-flow.helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the canonical home readiness markers and store key", () => {
    expect(HOME_READY_MARKERS).toEqual([
      "Start New Game",
      "Continue Game",
      "Current Game in Progress",
      "Game Stats",
    ]);
    expect(PERSISTED_STORE_KEY).toBe("dong-storage");
  });

  it("creates a reusable default setup journey dataset", () => {
    expect(createSetupJourneyDataset()).toEqual({
      playerNames: ["Alex", "Morgan"],
      matches: [
        { homeTeam: "Arsenal", awayTeam: "Chelsea" },
        { homeTeam: "Liverpool", awayTeam: "Everton" },
      ],
      commonMatchIndex: 0,
      matchesPerPlayer: 1,
    });
  });

  it("lets callers override the setup journey dataset", () => {
    expect(
      createSetupJourneyDataset({
        playerNames: ["Jamie"],
        matches: [{ homeTeam: "Porto", awayTeam: "Benfica" }],
        commonMatchIndex: 0,
        matchesPerPlayer: 2,
      }),
    ).toEqual({
      playerNames: ["Jamie"],
      matches: [{ homeTeam: "Porto", awayTeam: "Benfica" }],
      commonMatchIndex: 0,
      matchesPerPlayer: 2,
    });
  });

  it("returns multiple representative setup journey datasets", () => {
    const datasets = createSetupJourneyDatasets();

    expect(datasets).toHaveLength(2);
    expect(datasets[0]).toEqual({
      playerNames: ["Alex", "Morgan"],
      matches: [
        { homeTeam: "Arsenal", awayTeam: "Chelsea" },
        { homeTeam: "Liverpool", awayTeam: "Everton" },
      ],
      commonMatchIndex: 0,
      matchesPerPlayer: 1,
    });
    expect(datasets[1]).toEqual({
      playerNames: ["Alex", "Morgan", "Jamie"],
      matches: [
        { homeTeam: "Barcelona", awayTeam: "Real Madrid" },
        { homeTeam: "PSG", awayTeam: "Marseille" },
      ],
      commonMatchIndex: 1,
      matchesPerPlayer: 2,
    });
  });

  it("builds persisted browser state from a setup dataset", () => {
    const dataset = createSetupJourneyDataset({
      playerNames: ["Alex", "Morgan"],
      matches: [
        { homeTeam: "Arsenal", awayTeam: "Chelsea" },
        { homeTeam: "Liverpool", awayTeam: "Everton" },
      ],
      commonMatchIndex: 1,
      matchesPerPlayer: 3,
    });

    expect(buildPersistedBrowserStateFromSetupDataset(dataset)).toEqual({
      state: {
        players: [
          { id: "p1", name: "Alex" },
          { id: "p2", name: "Morgan" },
        ],
        matches: [
          {
            id: "m1",
            homeTeam: "Arsenal",
            awayTeam: "Chelsea",
            homeGoals: 0,
            awayGoals: 0,
          },
          {
            id: "m2",
            homeTeam: "Liverpool",
            awayTeam: "Everton",
            homeGoals: 0,
            awayGoals: 0,
          },
        ],
        commonMatchId: "m2",
        playerAssignments: { p1: ["m2"], p2: ["m2"] },
        matchesPerPlayer: 3,
        history: [],
        theme: "light",
      },
      version: 0,
    });
  });

  it("dismisses onboarding when the skip control is visible", async () => {
    const { page, skipButton } = createMockPage(true);

    await dismissOnboardingIfPresent(page as unknown as Page);

    expect(page.getByText).toHaveBeenCalledWith("Skip");
    expect(skipButton.isVisible).toHaveBeenCalledWith({ timeout: 500 });
    expect(skipButton.click).toHaveBeenCalledTimes(1);
  });

  it("does not click skip when onboarding is not visible", async () => {
    const { page, skipButton } = createMockPage(false);

    await dismissOnboardingIfPresent(page as unknown as Page);

    expect(page.getByText).toHaveBeenCalledWith("Skip");
    expect(skipButton.isVisible).toHaveBeenCalledWith({ timeout: 500 });
    expect(skipButton.click).not.toHaveBeenCalled();
  });

  it("waits for browser flow readiness after loading and onboarding dismissal", async () => {
    const { page, skipButton } = createMockPage(true);

    await waitForBrowserFlowReady(page as unknown as Page, ["Start New Game"]);

    expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
    expect(skipButton.click).toHaveBeenCalledTimes(1);
    expect(page.waitForFunction).toHaveBeenCalledTimes(1);
    expect(page.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      ["Start New Game"],
      { timeout: 10_000 },
    );
  });
});
