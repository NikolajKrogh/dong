import type { Page } from "@playwright/test";

export const PERSISTED_STORE_KEY = "dong-storage" as const;

export const HOME_READY_MARKERS = [
  "Start New Game",
  "Continue Game",
  "Current Game in Progress",
  "Game Stats",
] as const;

export const ONBOARDING_DISMISS_TEXT = "Skip" as const;

export interface SetupJourneyMatchInput {
  homeTeam: string;
  awayTeam: string;
}

export interface SetupJourneyDataset {
  playerNames: string[];
  matches: SetupJourneyMatchInput[];
  commonMatchIndex: number;
  matchesPerPlayer: number;
}

export interface BrowserFlowPlayer {
  id: string;
  name: string;
  drinksTaken?: number;
}

export interface BrowserFlowMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface BrowserFlowPersistedState {
  state: {
    players: BrowserFlowPlayer[];
    matches: BrowserFlowMatch[];
    commonMatchId: string | null;
    playerAssignments: Record<string, string[]>;
    matchesPerPlayer: number;
    history: unknown[];
    theme: "light" | "dark";
  };
  version: 0;
}

export const createSetupJourneyDataset = (
  overrides: Partial<SetupJourneyDataset> = {},
): SetupJourneyDataset => ({
  playerNames: overrides.playerNames ?? ["Alex", "Morgan"],
  matches: overrides.matches ?? [
    { homeTeam: "Arsenal", awayTeam: "Chelsea" },
    { homeTeam: "Liverpool", awayTeam: "Everton" },
  ],
  commonMatchIndex: overrides.commonMatchIndex ?? 0,
  matchesPerPlayer: overrides.matchesPerPlayer ?? 1,
});

export const createSetupJourneyDatasets = (): SetupJourneyDataset[] => [
  createSetupJourneyDataset(),
  createSetupJourneyDataset({
    playerNames: ["Alex", "Morgan", "Jamie"],
    matches: [
      { homeTeam: "Barcelona", awayTeam: "Real Madrid" },
      { homeTeam: "PSG", awayTeam: "Marseille" },
    ],
    commonMatchIndex: 1,
    matchesPerPlayer: 2,
  }),
];

export const buildPersistedBrowserStateFromSetupDataset = (
  dataset: SetupJourneyDataset,
): BrowserFlowPersistedState => {
  const players: BrowserFlowPlayer[] = dataset.playerNames.map(
    (name, index) => ({
      id: `p${index + 1}`,
      name,
    }),
  );

  const matches: BrowserFlowMatch[] = dataset.matches.map((match, index) => ({
    id: `m${index + 1}`,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeGoals: 0,
    awayGoals: 0,
  }));

  const commonMatchId =
    dataset.commonMatchIndex >= 0 && dataset.commonMatchIndex < matches.length
      ? (matches[dataset.commonMatchIndex]?.id ?? null)
      : null;

  const playerAssignments = Object.fromEntries(
    players.map((player) => [player.id, commonMatchId ? [commonMatchId] : []]),
  );

  return {
    state: {
      players,
      matches,
      commonMatchId,
      playerAssignments,
      matchesPerPlayer: dataset.matchesPerPlayer,
      history: [],
      theme: "light",
    },
    version: 0,
  };
};

export const dismissOnboardingIfPresent = async (page: Page) => {
  const skipButton = page.getByText(ONBOARDING_DISMISS_TEXT);
  const onboardingVisible = await skipButton
    .isVisible({ timeout: 500 })
    .catch(() => false);

  if (onboardingVisible) {
    await skipButton.click();
  }
};

export const waitForBrowserFlowReady = async (
  page: Page,
  markers: readonly string[] = HOME_READY_MARKERS,
) => {
  await page.waitForLoadState("networkidle");
  await dismissOnboardingIfPresent(page);

  await page.waitForFunction(
    (currentMarkers) =>
      currentMarkers.some((marker) =>
        document.body?.innerText?.includes(marker),
      ),
    markers,
    { timeout: 10_000 },
  );
};
