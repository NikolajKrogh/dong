import { useState, useEffect } from 'react';
import { ApiResponse, TeamWithLeague, cleanTeamName } from '../utils/matchUtils';

/**
 * Custom hook for fetching match data from football APIs
 */
export function useMatchData() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [teamsData, setTeamsData] = useState<TeamWithLeague[]>([]);
  const [apiData, setApiData] = useState<ApiResponse[]>([]);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      try {
        // League API URLs
        const leagueUrls = [
          // Premier League
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.1.json",
          // Championship
          "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.2.json",
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

        // Fetch all leagues in parallel
        const responses = await Promise.all(
          leagueUrls.map((url) => fetch(url))
        );

        // Process responses
        const allData: ApiResponse[] = [];
        const allTeams: TeamWithLeague[] = [];
        const leagueSet = new Set<string>();

        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];

          if (!response.ok) {
            console.warn(
              `API for ${leagueNames[i]} responded with status: ${response.status}`
            );
            continue;
          }

          const data: ApiResponse = await response.json();
          allData.push(data);

          // Extract unique team names from matches with league info
          const leagueName = leagueNames[i];
          leagueSet.add(leagueName);

          const teamSet = new Set<string>();
          data.matches.forEach((match) => {
            const homeTeam = match.team1 ? cleanTeamName(match.team1) : "";
            const awayTeam = match.team2 ? cleanTeamName(match.team2) : "";

            // Extract time from date if it exists
            if (match.date && !match.time) {
              if (match.date.includes("T")) {
                const timePart = match.date.split("T")[1];
                match.time = timePart.substring(0, 5); // Extract HH:MM
              }
            }

            if (homeTeam) teamSet.add(homeTeam);
            if (awayTeam) teamSet.add(awayTeam);
          });

          // Add teams with league info
          Array.from(teamSet).forEach((team) => {
            allTeams.push({
              key: `${team}-${leagueName}`,
              value: team,
              league: leagueName,
            });
          });
        }

        // Set the leagues and teams
        setApiData(allData);
        setAvailableLeagues(Array.from(leagueSet));

        // Sort teams alphabetically
        const sortedTeams = allTeams.sort((a, b) =>
          a.value.localeCompare(b.value)
        );

        setTeamsData(sortedTeams);
        console.log(
          "Teams loaded:",
          sortedTeams.length,
          "from",
          leagueSet.size,
          "leagues"
        );
      } catch (error) {
        console.error(
          "Error fetching teams:",
          error instanceof Error ? error.message : String(error)
        );
        setIsError(true);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load teams"
        );

        // Fallback to static list on error
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
  }, []);

  return {
    isLoading,
    isError,
    errorMessage,
    teamsData,
    apiData,
    availableLeagues,
  };
}