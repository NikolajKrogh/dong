import { useState, useEffect, useCallback } from "react";
import {
  ApiResponse,
  TeamWithLeague,
} from "../utils/matchUtils";
import { useGameStore } from "../store/store";
import { AVAILABLE_LEAGUES, LeagueEndpoint } from "../constants/leagues";
import {
  getMatchDiscoveryApiClient,
  type MatchDiscoveryRequest,
  type NormalizedMatch,
} from "../utils/commandApiClient";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const RAW_NETWORK_ERROR_MESSAGE_REGEX =
  /fetch failed|network request failed|load failed/i;
const GENERIC_MATCH_DISCOVERY_ERROR_MESSAGE =
  "Match discovery is temporarily unavailable.";

/**
 * Maps a `YYYY-MM-DD` selection onto the `requestedAt` the discovery API expects,
 * returning undefined for an absent or malformed date so the caller falls back to
 * the server's default (today).
 *
 * Exported because the lobby's match picker needs the identical mapping: omitting
 * `requestedAt` pins discovery to today, which silently returns nothing at all
 * during an off-season gap.
 */
export const buildRequestedAt = (
  selectedDate?: string,
): string | undefined => {
  if (!selectedDate || !DATE_ONLY_REGEX.test(selectedDate)) {
    return undefined;
  }

  return `${selectedDate}T00:00:00.000Z`;
};

const buildLeagueLookup = (configuredLeagues: LeagueEndpoint[]) => {
  const lookup = new Map<string, LeagueEndpoint>();

  configuredLeagues.forEach((league) => {
    lookup.set(league.code, league);
  });

  AVAILABLE_LEAGUES.forEach((league) => {
    if (!lookup.has(league.code)) {
      lookup.set(league.code, league);
    }
  });

  return lookup;
};

const mapNormalizedMatchesToApiData = (
  configuredLeagues: LeagueEndpoint[],
  normalizedMatches: NormalizedMatch[],
): ApiResponse[] => {
  return configuredLeagues.map((league) => ({
    name: league.name,
    matches: normalizedMatches
      .filter((match) => match.league === league.code)
      .map((match) => ({
        id: match.id,
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
};

const extractTeamsFromNormalizedMatches = (
  apiData: ApiResponse[],
): TeamWithLeague[] => {
  const allTeams: TeamWithLeague[] = [];
  const processedTeams = new Set<string>();

  apiData.forEach((leagueData) => {
    leagueData.matches.forEach((match) => {
      // Dedupe per (team, league): the same team name can legitimately appear in
      // more than one league, and each is a distinct selectable option.
      const team1Key = `${match.team1}-${leagueData.name}`;
      if (match.team1 && !processedTeams.has(team1Key)) {
        processedTeams.add(team1Key);
        allTeams.push({
          key: team1Key,
          value: match.team1,
          league: leagueData.name,
        });
      }

      const team2Key = `${match.team2}-${leagueData.name}`;
      if (match.team2 && !processedTeams.has(team2Key)) {
        processedTeams.add(team2Key);
        allTeams.push({
          key: team2Key,
          value: match.team2,
          league: leagueData.name,
        });
      }
    });
  });

  return allTeams.sort((a, b) => a.value.localeCompare(b.value));
};

const getClientSafeErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return GENERIC_MATCH_DISCOVERY_ERROR_MESSAGE;
  }

  const trimmedMessage = error.message.trim();

  if (
    trimmedMessage.length === 0 ||
    RAW_NETWORK_ERROR_MESSAGE_REGEX.test(trimmedMessage)
  ) {
    return GENERIC_MATCH_DISCOVERY_ERROR_MESSAGE;
  }

  return trimmedMessage;
};

/**
 * Load and process match + team data for configured leagues.
 * @description Fetches each league scoreboard for the selected date, extracts simplified match objects,
 * unique team list and caches logos; provides loading & error state.
 * @param selectedDate Optional YYYY-MM-DD date (defaults handled by formatter when undefined/invalid).
 * @returns State bundle (isLoading, isError, errorMessage, teamsData, apiData, availableLeagues).
 */
export function useMatchData(selectedDate?: string) {
  /** Indicates if data is currently loading. */
  const [isLoading, setIsLoading] = useState(false);
  /** Whether an error occurred. */
  const [isError, setIsError] = useState(false);
  /** Error message (if any). */
  const [errorMessage, setErrorMessage] = useState("");
  /** Processed unique team list. */
  const [teamsData, setTeamsData] = useState<TeamWithLeague[]>([]);
  /** Raw structured API data grouped by league. */
  const [apiData, setApiData] = useState<any[]>([]);
  /** Leagues for which data was successfully retrieved. */
  const [availableLeagues, setAvailableLeagues] = useState<LeagueEndpoint[]>(
    []
  );

  /** User configured leagues (determine which endpoints to fetch). */
  const configuredLeagues = useGameStore((state) => state.configuredLeagues);

  /**
   * Fetch & process league scoreboards, building match + team collections.
    * @description Handles uniqueness filtering, sorting, and client-safe error state when requests fail.
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      const leagueEndpoints = configuredLeagues;
      if (leagueEndpoints.length === 0) {
        setApiData([]);
        setTeamsData([]);
        setAvailableLeagues([]);
        return;
      }

      const leagueLookup = buildLeagueLookup(leagueEndpoints);
      const request: MatchDiscoveryRequest = {
        leagueCodes: leagueEndpoints.map((league) => league.code),
        requestedAt: buildRequestedAt(selectedDate),
      };
      const normalizedMatches = await getMatchDiscoveryApiClient().discoverMatches(
        request,
      );

      const availableLeagueCodes = new Set(request.leagueCodes);
      const resolvedAvailableLeagues = request.leagueCodes
        .map((leagueCode) => leagueLookup.get(leagueCode))
        .filter((league): league is LeagueEndpoint => Boolean(league))
        .filter((league) => availableLeagueCodes.has(league.code));

      const groupedApiData = mapNormalizedMatchesToApiData(
        resolvedAvailableLeagues,
        normalizedMatches,
      );

      setApiData(groupedApiData);
      setAvailableLeagues(resolvedAvailableLeagues);
      setTeamsData(extractTeamsFromNormalizedMatches(groupedApiData));
    } catch (error) {
      console.error(
        "Error fetching teams:",
        error instanceof Error ? error.message : String(error)
      );
      setIsError(true);
      setErrorMessage(getClientSafeErrorMessage(error));
      setApiData([]);
      setTeamsData([]);
      setAvailableLeagues([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, configuredLeagues]);

  /** Trigger fetch on mount or when dependencies change. */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    isLoading,
    isError,
    errorMessage,
    teamsData,
    apiData,
    availableLeagues,
  };
}
