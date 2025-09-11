import { useEffect } from 'react';
import { useGameStore } from '../store/store';
import { getTeamLogo, cacheTeamLogo, getHardcodedTeamLogoOnly, clearOverriddenLogos } from '../utils/teamLogos';

/**
 * Hook to load persisted team logos from AsyncStorage when resuming a game
 * This ensures that team logos cached from previous sessions are available,
 * but only for teams that don't have hardcoded assets
 */
export const usePersistedTeamLogos = () => {
  const matches = useGameStore((state) => state.matches);

  useEffect(() => {
    const loadPersistedLogos = async () => {
      if (matches.length === 0) return;

      // First, clear any cached API logos that have hardcoded alternatives
      clearOverriddenLogos();

      // Extract unique team names from current matches
      const teamNames = new Set<string>();
      matches.forEach((match) => {
        if (match.homeTeam) teamNames.add(match.homeTeam);
        if (match.awayTeam) teamNames.add(match.awayTeam);
      });

      const teamNamesList = Array.from(teamNames);

      // Load logos from AsyncStorage for each team, but only if they don't have hardcoded assets
      for (const teamName of teamNamesList) {
        try {
          // Check if this team already has a hardcoded logo
          const hardcodedLogo = getHardcodedTeamLogoOnly(teamName);
          if (hardcodedLogo) {
            // Skip loading from AsyncStorage if we have a hardcoded logo
            continue;
          }

          // Only load from AsyncStorage if no hardcoded logo exists
          const logoUrl = await getTeamLogo(teamName);
          if (logoUrl) {
            // Populate the memory cache with the persisted logo
            cacheTeamLogo(teamName, logoUrl);
          }
        } catch (error) {
          console.error(`Error loading persisted logo for ${teamName}:`, error);
        }
      }
    };

    loadPersistedLogos();
  }, [matches]);
};
