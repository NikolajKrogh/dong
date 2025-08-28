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
 * Fetch raw data from a given ESPN endpoint.
 * @description Thin wrapper over global fetch for direct scoreboard calls.
 * @param url Endpoint URL.
 * @returns Fetch response promise.
 */
const fetchDataFromESPN = async (url: string): Promise<Response> => {
  return fetch(url);
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
   * @description Handles logo caching, uniqueness filtering, sorting, and fallback population when requests fail.
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      /** Date parameter for API queries. */
      const dateParam = formatDateForAPI(selectedDate);

      /** League endpoints to query. */
      const leagueEndpoints = configuredLeagues;

      /** Parallel fetch promises for each league scoreboard. */
      const responses = await Promise.all(
        leagueEndpoints.map((league) =>
          fetchDataFromESPN(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateParam}`
          )
        )
      );

      /** Per-league match collections. */
      const allData: any[] = [];
      /** Unique teams aggregate. */
      const allTeams: TeamWithLeague[] = [];
      /** Map of leagues encountered. */
      const leagueMap = new Map<string, LeagueEndpoint>();
      /** Track team names already included. */
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
      setAvailableLeagues([{ name: "Premier League", code: "eng.1" }]);
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
