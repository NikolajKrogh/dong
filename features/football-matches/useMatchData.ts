import { useState, useEffect, useCallback, useRef } from "react";
import {
  ApiResponse,
  TeamWithLeague,
} from "./matchFilters";
import { useGameStore } from "../../store/gameStore";
import { AVAILABLE_LEAGUES, type LeagueEndpoint } from "../../constants/leagues";
import {
  getMatchDiscoveryApiClient,
  type MatchDiscoveryRequest,
  type NormalizedMatch,
} from "./matchDiscoveryAdapter";

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
const buildRequestedAt = (
  selectedDate?: string,
): string | undefined => {
  if (!selectedDate || !DATE_ONLY_REGEX.test(selectedDate)) {
    return undefined;
  }

  return `${selectedDate}T00:00:00.000Z`;
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
  const generationRef = useRef(0);
  /** Indicates if data is currently loading. */
  const [isLoading, setIsLoading] = useState(false);
  /** Whether an error occurred. */
  const [isError, setIsError] = useState(false);
  /** Error message (if any). */
  const [errorMessage, setErrorMessage] = useState("");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
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
    const generation = ++generationRef.current;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      const catalog = new Map(AVAILABLE_LEAGUES.map(league => [league.code, league]));
      const leagueEndpoints = configuredLeagues
        .map(league => catalog.get(league.code) ?? league);
      if (leagueEndpoints.length === 0) {
        setApiData([]);
        setTeamsData([]);
        setAvailableLeagues([]);
        setAvailabilityMessage("");
        return;
      }

      const leagueLookup = new Map(leagueEndpoints.map(league => [league.code, league]));
      const request: MatchDiscoveryRequest = {
        leagueCodes: leagueEndpoints.map((league) => league.code),
        requestedAt: buildRequestedAt(selectedDate),
      };
      const discovery = await getMatchDiscoveryApiClient().discoverMatches(
        request,
      );
      if (generationRef.current !== generation) return;

      const incompleteGroups = discovery.groups.filter(group => group.availability !== "available" || group.isStale);
      const incompleteNames = [...new Set(incompleteGroups.map(group => leagueLookup.get(group.leagueCode)?.name ?? group.leagueCode))];
      const incomplete = discovery.availability !== "available" || incompleteGroups.length > 0;
      let availabilityNotice = "";
      if (incompleteNames.length) {
        availabilityNotice = `Matches for ${incompleteNames.join(", ")} may be missing or out of date. Available matches are still shown.`;
      } else if (incomplete) {
        availabilityNotice = "Some matches may be missing or out of date. Available matches are still shown.";
      }
      setAvailabilityMessage(availabilityNotice);

      const availableLeagueCodes = new Set(request.leagueCodes);
      const resolvedAvailableLeagues = request.leagueCodes
        .map((leagueCode) => leagueLookup.get(leagueCode))
        .filter((league): league is LeagueEndpoint => Boolean(league))
        .filter((league) => availableLeagueCodes.has(league.code));

      const groupedApiData = mapNormalizedMatchesToApiData(
        resolvedAvailableLeagues,
        discovery.matches,
      );

      setApiData(groupedApiData);
      setAvailableLeagues(resolvedAvailableLeagues);
      setTeamsData(extractTeamsFromNormalizedMatches(groupedApiData));
    } catch (error) {
      if (generationRef.current !== generation) return;
      console.error(
        "Error fetching teams:",
        error instanceof Error ? error.message : String(error)
      );
      setIsError(true);
      setErrorMessage(getClientSafeErrorMessage(error));
      // Keep accepted data visible when only a background refresh fails.
    } finally {
      if (generationRef.current === generation) setIsLoading(false);
    }
  }, [selectedDate, configuredLeagues]);

  /** Trigger fetch on mount or when dependencies change. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the external room/request lifecycle; this is not derived render state.
    fetchData();
    // Invalidate every in-flight request when the selection changes or unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generationRef.current++; };
  }, [fetchData]);

  return {
    isLoading,
    isError,
    errorMessage,
    availabilityMessage,
    retry: fetchData,
    teamsData,
    apiData,
    availableLeagues,
  };
}
