import { useState, useEffect } from 'react';
import { ImageSourcePropType } from 'react-native';
import { getHardcodedTeamLogoOnly, getTeamLogo } from '../utils/teamLogos';

/**
 * Hook to get team logo with priority: hardcoded assets > cached API logos > AsyncStorage
 * Prioritizes hardcoded team logos, then falls back to API-fetched logos
 */
export const useTeamLogo = (teamName: string): ImageSourcePropType => {
  const [logoSource, setLogoSource] = useState<ImageSourcePropType>(() => {
    // Return default logo immediately if teamName is empty
    if (!teamName || teamName.trim() === '') {
      return require('../assets/images/teams/default.png');
    }

    // First check for hardcoded logo only
    const hardcodedLogo = getHardcodedTeamLogoOnly(teamName);
    if (hardcodedLogo) {
      return hardcodedLogo;
    }
    
    // If no hardcoded logo, use default logo initially
    return require('../assets/images/teams/default.png');
  });

  useEffect(() => {
    const loadAsyncLogo = async () => {
      // Skip if teamName is empty
      if (!teamName || teamName.trim() === '') {
        return;
      }

      // First check if we have a hardcoded logo - if so, use it and don't fetch from API cache
      const hardcodedLogo = getHardcodedTeamLogoOnly(teamName);
      if (hardcodedLogo) {
        setLogoSource(hardcodedLogo);
        return; // Don't override hardcoded logos with API logos
      }

      // Only if there's no hardcoded logo, check for persisted API logo
      try {
        const persistedLogo = await getTeamLogo(teamName);
        if (persistedLogo) {
          setLogoSource({ uri: persistedLogo });
        }
      } catch (error) {
        console.error(`Error loading persisted logo for ${teamName}:`, error);
      }
    };

    loadAsyncLogo();
  }, [teamName]);

  return logoSource;
};
