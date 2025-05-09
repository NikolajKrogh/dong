import { useState, useEffect } from "react";
import axios from "axios";
import { TeamWithLeague } from "../utils/matchUtils";

interface LeagueData {
  name: string;
  matches: Array<{
    team1: string;
    team2: string;
  }>;
}

/**
 * @brief Custom hook to fetch team data from multiple league JSON files.
 *
 * This hook fetches data from multiple football league JSON files,
 * processes the data to extract teams.
 *
 * @returns Object containing loading state, error state, error message, team data, and available leagues.
 */
export const useTeamData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [teamsData, setTeamsData] = useState<TeamWithLeague[]>([]);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeamData = async () => {
      setIsLoading(true);
      setIsError(false);

      const leagueUrls = [
        // Premier League
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.1.json",
        // Championship
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.2.json",
        // EFL League One
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.3.json",
        // Bundesliga
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/de.1.json",
        // La Liga
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/es.1.json",
        // Serie A
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/it.1.json",
        // Ligue 1
        "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/fr.1.json",
      ];

      const leagueNames = [
        "Premier League",
        "Championship",
        "Bundesliga",
        "La Liga",
        "Serie A",
        "Ligue 1",
      ];

      try {
        const teams = new Map<string, TeamWithLeague>();
        const leagues = new Set<string>();

        // Fetch data from each URL
        const responses = await Promise.all(
          leagueUrls.map((url, index) =>
            axios.get(url).then((res) => ({
              data: res.data,
              leagueName: leagueNames[index],
            }))
          )
        );

        // Process each response
        responses.forEach(({ data, leagueName }) => {
          leagues.add(leagueName);

          // Extract teams from matches
          if (data.matches) {
            data.matches.forEach((match: any) => {
              if (match.team1) {
                const teamKey = match.team1.toLowerCase();
                if (!teams.has(teamKey)) {
                  teams.set(teamKey, {
                    key: teamKey,
                    value: match.team1,
                    league: leagueName,
                  });
                }
              }

              if (match.team2) {
                const teamKey = match.team2.toLowerCase();
                if (!teams.has(teamKey)) {
                  teams.set(teamKey, {
                    key: teamKey,
                    value: match.team2,
                    league: leagueName,
                  });
                }
              }
            });
          }
        });

        setTeamsData(Array.from(teams.values()));
        setAvailableLeagues(Array.from(leagues));
      } catch (error) {
        console.error("Error fetching team data:", error);
        setIsError(true);
        setErrorMessage("Failed to fetch team data");

        setTeamsData([]);
        setAvailableLeagues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamData();
  }, []);

  return {
    isLoading,
    isError,
    errorMessage,
    teamsData,
    availableLeagues,
  };
};
