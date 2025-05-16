import { useState, useEffect, useCallback } from "react";
import {
  TeamWithLeague,
  cleanTeamName,
  formatDateForAPI,
} from "../utils/matchUtils";
import { ESPNResponse, ESPNEvent } from "../types/espn";
import { cacheTeamLogo, cacheLeagueLogo } from "../utils/teamLogos";
import { useGameStore } from "../store/store";
import { LeagueEndpoint } from "../constants/leagues";

/**
 * @brief Fetches data directly from a specified URL.
 *
 * This function is a simple wrapper around the native `fetch` API.
 * It's used here to make direct requests to the ESPN API without any proxy.
 *
 * @param {string} url The URL to fetch data from.
 * @return {Promise<Response>} A promise that resolves with the Response object
 *                             representing the response to the request.
 */
const fetchDataFromESPN = async (url: string): Promise<Response> => {
  return fetch(url);
};

/**
 * @brief Custom hook for fetching and processing match data from the ESPN API.
 *
 * This hook orchestrates the fetching of match and team data from the ESPN API
 * for a specified date and set of configured leagues. It manages loading states,
 * error handling, and processes the API response to extract relevant match details,
 * team information, and available leagues. It also caches team and league logos.
 *
 * @param {string} [selectedDate] - Optional. The date for which to fetch matches, expected in YYYY-MM-DD format.
 *                                  If not provided or if the format is invalid, it defaults to the current date
 *                                  as handled by `formatDateForAPI`.
 *
 * @return {object} An object containing the state and data related to match fetching:
 * @property {boolean} isLoading - True if data is currently being fetched or processed, false otherwise.
 * @property {boolean} isError - True if an error occurred during data fetching, false otherwise.
 * @property {string} errorMessage - A message describing the error, if one occurred.
 * @property {TeamWithLeague[]} teamsData - An array of `TeamWithLeague` objects, representing unique teams
 *                                          extracted from the fetched matches, sorted by team name.
 * @property {any[]} apiData - An array containing the processed data structured by league, where each element
 *                             has a `name` (league name) and `matches` (array of match details).
 * @property {LeagueEndpoint[]} availableLeagues - An array of `LeagueEndpoint` objects representing the leagues
 *                                                for which data was successfully fetched and processed.
 */
export function useMatchData(selectedDate?: string) {
  /**
   * @brief State: Indicates if match data is currently being loaded.
   */
  const [isLoading, setIsLoading] = useState(false);
  /**
   * @brief State: Indicates if an error occurred during data fetching.
   */
  const [isError, setIsError] = useState(false);
  /**
   * @brief State: Stores the error message if an error occurred.
   */
  const [errorMessage, setErrorMessage] = useState("");
  /**
   * @brief State: Stores the processed team data extracted from matches.
   */
  const [teamsData, setTeamsData] = useState<TeamWithLeague[]>([]);
  /**
   * @brief State: Stores the raw, structured API data, typically by league.
   */
  const [apiData, setApiData] = useState<any[]>([]);
  /**
   * @brief State: Stores the list of leagues for which data was available.
   */
  const [availableLeagues, setAvailableLeagues] = useState<LeagueEndpoint[]>(
    []
  );

  /**
   * @brief Retrieves the list of configured leagues from the global game store.
   * These leagues determine which ESPN endpoints are queried.
   */
  const configuredLeagues = useGameStore((state) => state.configuredLeagues);

  /**
   * @brief Asynchronous callback function to fetch and process match data.
   *
   * It performs the following steps:
   * 1. Sets loading state and resets error state.
   * 2. Formats the `selectedDate` for the API query.
   * 3. Fetches data from ESPN for each `configuredLeagues`.
   * 4. Processes each response:
   *    - Caches team and league logos.
   *    - Extracts league name and code.
   *    - Transforms event data into a simplified match structure (ID, teams, date, time, venue).
   *    - Aggregates all match data and unique team data.
   * 5. Updates `apiData`, `availableLeagues`, and `teamsData` states.
   * 6. Handles errors by setting error state and providing fallback team data.
   * 7. Resets loading state in the `finally` block.
   *
   * Dependencies: `selectedDate`, `configuredLeagues`.
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      /**
       * @brief The date parameter formatted for the ESPN API query.
       */
      const dateParam = formatDateForAPI(selectedDate);

      /**
       * @brief The list of league endpoints to fetch data from, derived from `configuredLeagues`.
       */
      const leagueEndpoints = configuredLeagues;

      /**
       * @brief An array of Promises, each representing a fetch request to an ESPN league scoreboard endpoint.
       */
      const responses = await Promise.all(
        leagueEndpoints.map((league) =>
          fetchDataFromESPN(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateParam}`
          )
        )
      );

      /**
       * @brief Accumulator for all processed data, structured by league.
       */
      const allData: any[] = [];
      /**
       * @brief Accumulator for all unique teams extracted from matches.
       */
      const allTeams: TeamWithLeague[] = [];
      /**
       * @brief Map to store unique available leagues encountered during processing.
       */
      const leagueMap = new Map<string, LeagueEndpoint>();
      /**
       * @brief Set to keep track of processed team names to avoid duplicates in `allTeams`.
       */
      const processedTeams = new Set<string>();

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];

        if (!response.ok) {
          console.warn(
            `API for ${leagueEndpoints[i].name} responded with status: ${response.status}`
          );
          continue; // Skip to the next league if the response is not OK
        }

        const data: ESPNResponse = await response.json();

        // Cache team logos from event competitors
        data.events.forEach((event: ESPNEvent) => {
          if (event.competitions) {
            event.competitions.forEach((competition) => {
              if (competition.competitors) {
                competition.competitors.forEach((competitor) => {
                  if (competitor.team?.displayName && competitor.team?.logo) {
                    cacheTeamLogo(
                      competitor.team.displayName,
                      competitor.team.logo
                    );
                  }
                });
              }
            });
          }
        });

        // Cache league logos
        if (data.leagues && data.leagues.length > 0) {
          for (const league of data.leagues) {
            if (league.logos && league.logos.length > 0) {
              const defaultLogo = league.logos.find(
                (logo) =>
                  (logo.rel?.includes?.("default") ?? false) ||
                  (logo.rel?.includes?.("full") ?? false)
              );

              if (defaultLogo && defaultLogo.href) {
                const appLeagueName = leagueEndpoints.find(
                  (l) => l.code === league.slug
                )?.name;

                if (appLeagueName) {
                  cacheLeagueLogo(appLeagueName, defaultLogo.href);
                }
              }
            }
          }
        }

        const leagueName = leagueEndpoints[i].name;
        leagueMap.set(leagueName, {
          name: leagueName,
          code: leagueEndpoints[i].code,
        });

        // Process matches from events
        const matches = data.events.map((event: ESPNEvent) => {
          let homeTeam = "";
          let awayTeam = "";

          // Attempt to parse team names from event name or shortName
          if (event.name && event.name.includes(" at ")) {
            const parts = event.name.split(" at ");
            awayTeam = parts[0].trim();
            homeTeam = parts[1].trim();
          } else if (event.shortName && event.shortName.includes(" @ ")) {
            const parts = event.shortName.split(" @ ");
            if (parts.length === 2) {
              awayTeam = parts[0].trim();
              homeTeam = parts[1].trim();
            }
          }
          // Fallback or further parsing might be needed if names are not in "TeamA at TeamB" format

          let time = "";
          if (event.date) {
            const dateObj = new Date(event.date);
            time = dateObj.toTimeString().substring(0, 5); // HH:MM format
          }

          return {
            id: event.id,
            team1: homeTeam,
            team2: awayTeam,
            date: event.date?.split("T")[0] || "", // YYYY-MM-DD format
            time: time,
            venue: event.venue?.displayName || "",
          };
        });

        allData.push({
          name: leagueName,
          matches: matches,
        });

        // Extract unique teams from the processed matches
        matches.forEach((match) => {
          if (match.team1 && !processedTeams.has(match.team1)) {
            processedTeams.add(match.team1);
            allTeams.push({
              key: `${match.team1}-${leagueName}`, // Composite key
              value: match.team1,
              league: leagueName,
            });
          }

          if (match.team2 && !processedTeams.has(match.team2)) {
            processedTeams.add(match.team2);
            allTeams.push({
              key: `${match.team2}-${leagueName}`, // Composite key
              value: match.team2,
              league: leagueName,
            });
          }
        });
      }

      setApiData(allData);
      setAvailableLeagues(Array.from(leagueMap.values()));

      const sortedTeams = allTeams.sort((a, b) =>
        a.value.localeCompare(b.value)
      );
      setTeamsData(sortedTeams);
    } catch (error) {
      console.error(
        "Error fetching teams:",
        error instanceof Error ? error.message : String(error)
      );
      setIsError(true);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load teams"
      );

      // Provide fallback data in case of an error
      const fallbackTeams = [
        "Arsenal",
        "Aston Villa",
        "Bournemouth",
        "Brentford",
        "Brighton & Hove Albion",
        "Chelsea",
        "Crystal Palace",
        "Everton",
        "Fulham",
        "Leicester City",
        "Liverpool",
        "Manchester City",
        "Manchester United",
        "Newcastle United",
        "Nottingham Forest",
        "Southampton",
        "Tottenham Hotspur",
        "West Ham United",
        "Wolverhampton Wanderers",
        "Ipswich Town",
      ].map((team) => ({
        key: team,
        value: cleanTeamName(team),
        league: "Premier League",
      }));

      setTeamsData(fallbackTeams);
      setAvailableLeagues([
        { name: "Premier League", code: "eng.1" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, configuredLeagues]);

  /**
   * @brief Effect hook to trigger the `fetchData` callback when the component mounts
   * or when `fetchData` (which depends on `selectedDate` or `configuredLeagues`) changes.
   */
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
