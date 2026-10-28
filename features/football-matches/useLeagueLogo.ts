import { useQuery } from "@tanstack/react-query";
import type { ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Map of league name -> local logo asset. */
interface LeagueLogos {
  [key: string]: ImageSourcePropType;
}

const LEAGUE_LOGOS: LeagueLogos = {
  "Premier League": require("../../assets/images/leagues/premier-league.png"),
  Championship: require("../../assets/images/leagues/championship.png"),
  Bundesliga: require("../../assets/images/leagues/bundesliga.png"),
  "La Liga": require("../../assets/images/leagues/la-liga.png"),
  "Serie A": require("../../assets/images/leagues/serie-a.png"),
  "Ligue 1": require("../../assets/images/leagues/ligue-1.png"),
  Superliga: require("../../assets/images/leagues/superliga.png"),
};

const loadLeagueLogo = async (
  leagueName: string,
): Promise<ImageSourcePropType | null> => {
  let cachedLogo: string | null = null;
  try {
    cachedLogo = await AsyncStorage.getItem(`league_logo_${leagueName}`);
  } catch (error) {
    console.error("Error fetching cached league logo:", error);
  }
  if (cachedLogo) return { uri: cachedLogo };
  return null;
};

/** Resolve bundled or already cached logos without acquiring a scoreboard for an image. */
export function useLeagueLogo(leagueName: string, leagueCode?: string) {
  const localLogo = LEAGUE_LOGOS[leagueName];
  const { data: remoteLogo, isLoading } = useQuery({
    queryKey: ["league-logo", leagueName, leagueCode],
    enabled: !localLogo,
    queryFn: () => loadLeagueLogo(leagueName),
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
