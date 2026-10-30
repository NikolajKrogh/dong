import { useQueries, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { AVAILABLE_LEAGUES, type LeagueEndpoint } from "../../constants/leagues";
import { useAppVisibility } from "../../platform";
import { createMatchDiscoveryApiClient, type NormalizedMatch } from "./matchDiscoveryAdapter";
import { getFootballMatchService } from "./footballMatchService";
import {
  createMatchDiscoveryQueries,
  type DiscoverySelection,
  type LeagueDiscoveryState,
} from "./matchDiscoveryQueries";
import type { ApiResponse, TeamWithLeague } from "./matchFilters";

type MatchDiscoveryQueries = ReturnType<typeof createMatchDiscoveryQueries>;
interface MatchDataResult {
  apiData: ApiResponse[];
  teamsData: TeamWithLeague[];
  leagueStates: LeagueDiscoveryState[];
  isInitialLoading: boolean;
  isUpdating: boolean;
  retry(): Promise<void>;
}

const discoveryQueriesByClient = new WeakMap<QueryClient, MatchDiscoveryQueries>();

function getOrCreateDiscoveryQueries(queryClient: QueryClient): MatchDiscoveryQueries {
  let discoveryQueries = discoveryQueriesByClient.get(queryClient);
  if (!discoveryQueries) {
    discoveryQueries = createMatchDiscoveryQueries({
      queryClient,
      discoverOnce: ({ date, leagueCodes }) => createMatchDiscoveryApiClient(
        getFootballMatchService({ followUpPending: false }),
      ).discoverMatches({ leagueCodes, requestedAt: `${date}T00:00:00.000Z` }),
    });
    discoveryQueriesByClient.set(queryClient, discoveryQueries);
  }
  return discoveryQueries;
}

function mapNormalizedMatchesToApiData(
  leagues: LeagueEndpoint[],
  normalizedMatches: NormalizedMatch[],
): ApiResponse[] {
  return leagues.map((league) => ({
    name: league.name,
    matches: normalizedMatches
      .filter((match) => match.league === league.code)
      .map((match) => ({
        id: match.id,
        catalogMatchId: match.catalogMatchId,
        leagueCode: match.league,
        team1: match.homeTeam,
        team2: match.awayTeam,
        date: match.startDateTime.split("T")[0] || "",
        time: new Date(match.startDateTime).toTimeString().substring(0, 5),
        // Kept alongside the lossy display pair above so downstream consumers that
        // need a real instant are not forced to reassemble a UTC date with a local
        // time (see MatchData.startDateTime).
        startDateTime: match.startDateTime,
        venue: match.venue ?? "",
      })),
  }));
}

function extractTeamOptions(apiData: ApiResponse[]): TeamWithLeague[] {
  const teams = new Map<string, TeamWithLeague>();
  for (const league of apiData) {
    for (const match of league.matches) {
      // The same team can appear in multiple leagues as distinct selectable options.
      for (const name of [match.team1, match.team2]) {
        const key = `${name}-${league.name}`;
        if (name && !teams.has(key)) {
          teams.set(key, { key, value: name, league: league.name });
        }
      }
    }
  }
  return [...teams.values()].sort((a, b) => a.value.localeCompare(b.value));
}

/** Public picker interface; batching, source age and bounded Retry stay inside discoveryQueries. */
export function useMatchData(selection: DiscoverySelection): MatchDataResult {
  const queryClient = useQueryClient();
  const discoveryQueries = getOrCreateDiscoveryQueries(queryClient);
  const { isInteractive } = useAppVisibility();
  const activeSelection = { ...selection, active: selection.active && isInteractive };
  const queryResults = useQueries({ queries: discoveryQueries.createQueryOptions(activeSelection) });
  const viewModel = discoveryQueries.createViewModel(activeSelection, queryResults);
  const leagues = viewModel.leagueStates.map(({ leagueCode }) =>
    AVAILABLE_LEAGUES.find(league => league.code === leagueCode) ?? { code: leagueCode, name: leagueCode },
  );
  const apiData = mapNormalizedMatchesToApiData(leagues, viewModel.matches);
  return {
    apiData,
    teamsData: extractTeamOptions(apiData),
    leagueStates: viewModel.leagueStates,
    isInitialLoading: viewModel.isInitialLoading,
    isUpdating: viewModel.isUpdating,
    retry: () => discoveryQueries.retry(activeSelection),
  };
}
