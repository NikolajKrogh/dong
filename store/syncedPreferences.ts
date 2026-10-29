import { DEFAULT_SELECTED_LEAGUES, LEAGUE_ENDPOINTS, type LeagueEndpoint } from "../constants/leagues";

export type ThemeMode = "light" | "dark";

export interface SyncedPreferenceState {
  theme: ThemeMode;
  soundEnabled: boolean;
  commonMatchNotificationsEnabled: boolean;
  configuredLeagues: LeagueEndpoint[];
  defaultSelectedLeagues: LeagueEndpoint[];
}

const cloneLeagueEndpoints = (leagues: LeagueEndpoint[]) =>
  leagues.map((league) =>
    league.category
      ? {
        code: league.code,
        name: league.name,
        category: league.category,
      }
      : {
        code: league.code,
        name: league.name,
      },
  );

export const createDefaultSyncedPreferenceState = (): SyncedPreferenceState => ({
  theme: "light",
  soundEnabled: true,
  commonMatchNotificationsEnabled: true,
  configuredLeagues: cloneLeagueEndpoints(LEAGUE_ENDPOINTS),
  defaultSelectedLeagues: cloneLeagueEndpoints(DEFAULT_SELECTED_LEAGUES),
});

const normalizeLeagueEndpoint = (value: unknown): LeagueEndpoint | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<LeagueEndpoint>;

  if (
    typeof candidate.code !== "string" ||
    candidate.code.trim().length === 0 ||
    typeof candidate.name !== "string" ||
    candidate.name.trim().length === 0
  ) {
    return null;
  }

  if (
    typeof candidate.category === "string" &&
    candidate.category.trim().length > 0
  ) {
    return {
      code: candidate.code,
      name: candidate.name,
      category: candidate.category,
    };
  }

  return {
    code: candidate.code,
    name: candidate.name,
  };
};

const normalizeLeagueEndpointList = (
  value: unknown,
  fallback: LeagueEndpoint[],
) => {
  if (!Array.isArray(value)) {
    return cloneLeagueEndpoints(fallback);
  }

  if (value.length === 0) {
    return [];
  }

  const normalizedLeagues = value
    .map(normalizeLeagueEndpoint)
    .filter((league): league is LeagueEndpoint => Boolean(league));

  return normalizedLeagues.length > 0
    ? normalizedLeagues
    : cloneLeagueEndpoints(fallback);
};

export const serializeSyncedPreferenceState = (
  state: SyncedPreferenceState,
): SyncedPreferenceState => ({
  theme: state.theme,
  soundEnabled: state.soundEnabled,
  commonMatchNotificationsEnabled: state.commonMatchNotificationsEnabled,
  configuredLeagues: cloneLeagueEndpoints(state.configuredLeagues),
  defaultSelectedLeagues: cloneLeagueEndpoints(state.defaultSelectedLeagues),
});

export const hydrateSyncedPreferenceState = (
  value: unknown,
  fallback: SyncedPreferenceState = createDefaultSyncedPreferenceState(),
): SyncedPreferenceState => {
  const normalizedFallback = serializeSyncedPreferenceState(fallback);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalizedFallback;
  }

  const candidate = value as Partial<
    Record<keyof SyncedPreferenceState, unknown>
  >;

  return {
    theme:
      candidate.theme === "dark" || candidate.theme === "light"
        ? candidate.theme
        : normalizedFallback.theme,
    soundEnabled:
      typeof candidate.soundEnabled === "boolean"
        ? candidate.soundEnabled
        : normalizedFallback.soundEnabled,
    commonMatchNotificationsEnabled:
      typeof candidate.commonMatchNotificationsEnabled === "boolean"
        ? candidate.commonMatchNotificationsEnabled
        : normalizedFallback.commonMatchNotificationsEnabled,
    configuredLeagues: normalizeLeagueEndpointList(
      candidate.configuredLeagues,
      normalizedFallback.configuredLeagues,
    ),
    defaultSelectedLeagues: normalizeLeagueEndpointList(
      candidate.defaultSelectedLeagues,
      normalizedFallback.defaultSelectedLeagues,
    ),
  };
};
