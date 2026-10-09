import { useQuery } from "@tanstack/react-query";
import type { ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheLeagueLogo } from "../utils/teamLogos";

/** Map of league name -> local logo asset. */
interface LeagueLogos {
  [key: string]: ImageSourcePropType;
}

const LEAGUE_LOGOS: LeagueLogos = {
  "Premier League": require("../assets/images/leagues/premier-league.png"),
  Championship: require("../assets/images/leagues/championship.png"),
  Bundesliga: require("../assets/images/leagues/bundesliga.png"),
  "La Liga": require("../assets/images/leagues/la-liga.png"),
  "Serie A": require("../assets/images/leagues/serie-a.png"),
  "Ligue 1": require("../assets/images/leagues/ligue-1.png"),
  Superliga: require("../assets/images/leagues/superliga.png"),
};

const loadLeagueLogo = async (
  leagueName: string,
  leagueCode?: string,
  signal?: AbortSignal,
): Promise<ImageSourcePropType | null> => {
  let cachedLogo: string | null = null;
  try {
    cachedLogo = await AsyncStorage.getItem(`league_logo_${leagueName}`);
  } catch (error) {
    console.error("Error fetching cached league logo:", error);
  }
  if (cachedLogo) return { uri: cachedLogo };
  if (!leagueCode) return null;

  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard`,
      { signal },
    );

    if (!response.ok) {
      console.warn(
        `Failed to fetch league data for ${leagueCode}: ${response.status}`,
      );
      return null;
    }

    const data = await response.json();
    const defaultLogo = data.leagues?.[0]?.logos?.find(
      (logo: { rel: string[]; href: string }) =>
        logo.rel.includes("default") || logo.rel.includes("full"),
    );
    if (!defaultLogo?.href || signal?.aborted) return null;

    cacheLeagueLogo(leagueName, defaultLogo.href);
    return { uri: defaultLogo.href };
  } catch (error) {
    if (!signal?.aborted) {
      console.error(`Error fetching logo for ${leagueCode}:`, error);
    }
    return null;
  }
};

/** Resolve a league logo from bundled assets, storage, then ESPN. */
export function useLeagueLogo(leagueName: string, leagueCode?: string) {
  const localLogo = LEAGUE_LOGOS[leagueName];
  const { data: remoteLogo, isLoading } = useQuery({
    queryKey: ["league-logo", leagueName, leagueCode],
    enabled: !localLogo,
    queryFn: ({ signal }) => loadLeagueLogo(leagueName, leagueCode, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: "always",
  });

  return {
    logoSource: localLogo ?? remoteLogo ?? undefined,
    isLoading: localLogo ? false : isLoading,
  };
}
