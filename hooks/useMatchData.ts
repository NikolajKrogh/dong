import { useState, useEffect } from "react";
import {
  TeamWithLeague,
  cleanTeamName,
  formatDateForAPI,
} from "../utils/matchUtils";
import { ESPNResponse, ESPNEvent } from "../types/espn";
import { cacheTeamLogo, cacheLeagueLogo } from "../utils/teamLogos";

/**
 * @brief Makes direct requests without proxy.
 *
 * @param url The URL to fetch.
 * @return A promise that resolves with the response to that request.
 */
const fetchDataFromESPN = async (url: string) => {
  return fetch(url);
};

/**
 * @brief Custom hook for fetching match data from the ESPN API.
 *
 * This hook fetches team and match data from the ESPN API for a given date.
 * It handles loading states, errors, and provides the fetched data.
 *
 * @param selectedDate (optional) The date for which to fetch matches (expected YYYY-MM-DD).
 *        If not provided or invalid format, defaults to today's date.
 *
 * @return An object containing:
 *   - isLoading: A boolean indicating whether the data is currently being loaded.
 *   - isError: A boolean indicating whether an error occurred during the data fetching.
 *   - errorMessage: A string containing the error message, if any.
 *   - teamsData: An array of TeamWithLeague objects representing the fetched teams.
 *   - apiData: An array containing the raw API data.
 *   - availableLeagues: An array of strings representing the available league names.
 */
export function useMatchData(selectedDate?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [teamsData, setTeamsData] = useState<TeamWithLeague[]>([]);
  const [apiData, setApiData] = useState<any[]>([]);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      try {
        // Use the imported formatDateForAPI function
        const dateParam = formatDateForAPI(selectedDate);

        const leagueEndpoints = [
          { code: "eng.1", name: "Premier League" },
          { code: "eng.2", name: "Championship" },
          { code: "ger.1", name: "Bundesliga" },
          { code: "esp.1", name: "La Liga" },
          { code: "ita.1", name: "Serie A" },
          { code: "fra.1", name: "Ligue 1" },
          { code: "den.1", name: "Superliga" },
          { code: "ned.1", name: "Eredivisie" },
          { code: "por.1", name: "Portuguese Primeira Liga" },
          { code: "tur.1", name: "Turkish \n Süper Lig" },
          { code: "usa.1", name: "Major League Soccer" },
          { code: "sco.1", name: "Scottish Premiership" },
          { code: "bel.1", name: "Belgium Pro League" },
          { code: "rus.1", name: "Russian Premier Liga" },
          { code: "gre.1", name: "Greek Super League" },
        ];

        const responses = await Promise.all(
          leagueEndpoints.map((league) =>
            fetchDataFromESPN(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateParam}`
            )
          )
        );

        const allData: any[] = [];
        const allTeams: TeamWithLeague[] = [];
        const leagueSet = new Set<string>();
        const processedTeams = new Set<string>();

        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];

          if (!response.ok) {
            console.warn(
              `API for ${leagueEndpoints[i].name} responded with status: ${response.status}`
            );
            continue;
          }

          const data: ESPNResponse = await response.json();

          // Add this section to cache logos
          data.events.forEach((event) => {
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

          if (data.leagues && data.leagues.length > 0) {
            for (const league of data.leagues) {
              // Cache league logos if available
              if (league.logos && league.logos.length > 0) {
                // Find the default logo (prefer the one marked as default)
                const defaultLogo = league.logos.find(
                  (logo) =>
                    logo.rel.includes("default") || logo.rel.includes("full")
                );

                if (defaultLogo && defaultLogo.href) {
                  // Map the league name or abbreviation to our app's league name convention
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
          leagueSet.add(leagueName);

          const matches = data.events.map((event) => {
            let homeTeam = "";
            let awayTeam = "";

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

            let time = "";
            if (event.date) {
              const dateObj = new Date(event.date);
              time = dateObj.toTimeString().substring(0, 5);
            }

            return {
              id: event.id,
              team1: homeTeam,
              team2: awayTeam,
              date: event.date?.split("T")[0] || "",
              time: time,
              venue: event.venue?.displayName || "",
            };
          });

          allData.push({
            name: leagueName,
            matches: matches,
          });

          matches.forEach((match) => {
            if (match.team1 && !processedTeams.has(match.team1)) {
              processedTeams.add(match.team1);
              allTeams.push({
                key: `${match.team1}-${leagueName}`,
                value: match.team1,
                league: leagueName,
              });
            }

            if (match.team2 && !processedTeams.has(match.team2)) {
              processedTeams.add(match.team2);
              allTeams.push({
                key: `${match.team2}-${leagueName}`,
                value: match.team2,
                league: leagueName,
              });
            }
          });
        }

        setApiData(allData);
        setAvailableLeagues(Array.from(leagueSet));

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
        setAvailableLeagues(["Premier League"]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, [selectedDate]);

  return {
    isLoading,
    isError,
    errorMessage,
    teamsData,
    apiData,
    availableLeagues,
  };
}
