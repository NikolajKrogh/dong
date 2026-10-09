import { useQuery } from "@tanstack/react-query";
import type { TeamWithLeague } from "../utils/matchUtils";

const EMPTY_TEAMS: TeamWithLeague[] = [];
const EMPTY_LEAGUES: string[] = [];

const fetchTeamData = async (signal: AbortSignal) => {
  const leagueUrls = [
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.1.json",
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.2.json",
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/en.3.json",
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/de.1.json",
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/es.1.json",
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/it.1.json",
    "https://raw.githubusercontent.com/openfootball/football.json/refs/heads/master/2024-25/fr.1.json",
  ];
  const leagueNames = [
    "Premier League",
    "Championship",
    "EFL League One",
    "Bundesliga",
    "La Liga",
    "Serie A",
    "Ligue 1",
  ];

  try {
    const teams = new Map<string, TeamWithLeague>();
    const leagues = new Set<string>();
    const responses = await Promise.all(
      leagueUrls.map(async (url, index) => {
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          );
        }
        return {
          data: await response.json(),
          leagueName: leagueNames[index],
        };
      }),
    );

    responses.forEach(({ data, leagueName }) => {
      leagues.add(leagueName);

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

    return {
      teamsData: Array.from(teams.values()),
      availableLeagues: Array.from(leagues),
    };
  } catch (error) {
    if (!signal.aborted) console.error("Error fetching team data:", error);
    throw error;
  }
};

/** Load the remote team lists, exposing the same empty/error state on failure. */
export const useTeamData = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["setup-team-data"],
    queryFn: ({ signal }) => fetchTeamData(signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: "always",
  });

  return {
    isLoading,
    isError,
    errorMessage: isError ? "Failed to fetch team data" : "",
    teamsData: isError ? EMPTY_TEAMS : data?.teamsData ?? EMPTY_TEAMS,
    availableLeagues: isError ? EMPTY_LEAGUES : data?.availableLeagues ?? EMPTY_LEAGUES,
  };
};
