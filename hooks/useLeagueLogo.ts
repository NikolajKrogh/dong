import { useState, useEffect } from "react";
import { ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheLeagueLogo } from "../utils/teamLogos";

/**
 * @interface LeagueLogos
 * @brief Mapping of league names to their local image assets.
 */
interface LeagueLogos {
  [key: string]: ImageSourcePropType;
}

/**
 * @brief Local mapping of league names to their logo image assets.
 * 
 * This provides immediate access to common league logos without requiring
 * network requests or accessing AsyncStorage.
 */
const LEAGUE_LOGOS: LeagueLogos = {
  "Premier League": require("../assets/images/leagues/premier-league.png"),
  Championship: require("../assets/images/leagues/championship.png"),
  Bundesliga: require("../assets/images/leagues/bundesliga.png"),
  "La Liga": require("../assets/images/leagues/la-liga.png"),
  "Serie A": require("../assets/images/leagues/serie-a.png"),
  "Ligue 1": require("../assets/images/leagues/ligue-1.png"),
  Superliga: require("../assets/images/leagues/superliga.png"),
};

/**
 * @brief Custom hook to get a league logo, using a prioritized approach:
 * 1. Local assets (immediate)
 * 2. AsyncStorage cache (async but no network)
 * 3. API fetch (async with network request)
 *
 * @param leagueName The name of the league to retrieve the logo for
 * @param leagueCode Optional league code for API fetching when local/cached logo is not available
 * @returns {Object} Object with logoSource and loading state
 * @returns {ImageSourcePropType | undefined} logoSource - The image source for the logo, if found
 * @returns {boolean} isLoading - Whether the logo is still being loaded
 */
export function useLeagueLogo(leagueName: string, leagueCode?: string) {
  const [logoSource, setLogoSource] = useState<ImageSourcePropType | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // First try local logo (immediate)
    const localLogo = LEAGUE_LOGOS[leagueName];
    if (localLogo) {
      setLogoSource(localLogo);
      setIsLoading(false);
      return;
    }

    /**
     * @brief Orchestrates the logo loading process.
     * First tries AsyncStorage, then falls back to API if needed.
     */
    const loadLogo = async () => {
      // 1. Try AsyncStorage
      const foundInCache = await getStoredLogo();

      // 2. If not in cache, try API
      if (!foundInCache && leagueCode) {
        await fetchLogoFromAPI();
      }
    };

    /**
     * @brief Attempts to retrieve a cached logo from AsyncStorage.
     * @returns {Promise<boolean>} Whether a cached logo was found and set
     */
    const getStoredLogo = async () => {
      try {
        const key = `league_logo_${leagueName}`;
        const cachedLogo = await AsyncStorage.getItem(key);

        if (cachedLogo && isMounted) {
          setLogoSource({ uri: cachedLogo });
          setIsLoading(false);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error fetching cached league logo:", error);
        return false;
      }
    };

    /**
     * @brief Fetches a league logo from the ESPN API.
     * If successful, caches the logo for future use.
     */
    const fetchLogoFromAPI = async () => {
      if (!leagueCode) return;

      try {

        // Fetch league data from ESPN API
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard`
        );

        if (!response.ok) {
          console.warn(
            `Failed to fetch league data for ${leagueCode}: ${response.status}`
          );
          return;
        }

        const data = await response.json();

        // Find and extract logo
        if (data.leagues && data.leagues.length > 0) {
          const league = data.leagues[0];
          if (league.logos && league.logos.length > 0) {
            // Find the default logo (prefer the one marked as default)
            const defaultLogo = league.logos.find(
              (logo: { rel: string[]; href: string }) =>
                logo.rel.includes("default") || logo.rel.includes("full")
            );

            if (defaultLogo && defaultLogo.href && isMounted) {
              // Cache the logo
              cacheLeagueLogo(leagueName, defaultLogo.href);

              // Update state
              setLogoSource({ uri: defaultLogo.href });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching logo for ${leagueCode}:`, error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Start the loading process
    loadLogo();

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false;
    };
  }, [leagueName, leagueCode]);

  return { logoSource, isLoading };
}