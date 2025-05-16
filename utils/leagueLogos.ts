import { ImageSourcePropType } from "react-native";
import { getCachedLeagueLogo } from "./teamLogos";

// Define a type for the league logos
interface LeagueLogos {
  [key: string]: ImageSourcePropType;
}

// League logo mapping - using your existing logos
export const LEAGUE_LOGOS: LeagueLogos = {
  "Premier League": require("../assets/images/leagues/premier-league.png"),
  Championship: require("../assets/images/leagues/championship.png"),
  Bundesliga: require("../assets/images/leagues/bundesliga.png"),
  "La Liga": require("../assets/images/leagues/la-liga.png"),
  "Serie A": require("../assets/images/leagues/serie-a.png"),
  "Ligue 1": require("../assets/images/leagues/ligue-1.png"),
  Superliga: require("../assets/images/leagues/superliga.png"),
};

/**
 * Get a league logo, prioritizing local assets over API-cached logos
 * @param leagueName The name of the league to get the logo for
 * @returns The image source for the logo, or undefined if not found
 */
export const getLeagueLogo = (
  leagueName: string
): ImageSourcePropType | undefined => {
  // First try to get the logo from our local assets
  const localLogo = LEAGUE_LOGOS[leagueName];
  if (localLogo) {
    return localLogo;
  }

  // If no local logo found, try to get it from API cache
  const cachedApiLogo = getCachedLeagueLogo(leagueName);
  if (cachedApiLogo) {
    return { uri: cachedApiLogo };
  }

  // No logo found in either source
  return undefined;
};
