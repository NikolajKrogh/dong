import { useState, useEffect } from "react";
import { ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheLeagueLogo } from "../utils/teamLogos";

/**
 * Map of league name -> local logo asset.
 * @description Provides immediate offline access to common league logos.
 */
interface LeagueLogos {
  [key: string]: ImageSourcePropType;
}

/**
 * Local league logos.
 * @description Immediate synchronous assets avoiding network or storage lookups.
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
 * League logo hook.
 * @description Resolves league logo via priority: local asset -> cached (AsyncStorage) -> remote fetch.
 * @param {string} leagueName League display name.
 * @param {string} [leagueCode] Optional code for remote fetch fallback.
 * @returns {{logoSource: ImageSourcePropType | undefined; isLoading: boolean}} Logo state.
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

    /** Begin async resolution flow (cache -> API). */
    const loadLogo = async () => {
      // 1. Try AsyncStorage
      const foundInCache = await getStoredLogo();

      // 2. If not in cache, try API
      if (!foundInCache && leagueCode) {
        await fetchLogoFromAPI();
      }
    };

    /** Try cached logo from storage. */
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

    /** Fetch logo remotely and cache. */
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
