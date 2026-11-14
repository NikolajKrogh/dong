import { useQuery } from "@tanstack/react-query";
import type { ImageSourcePropType } from "react-native";
import { getHardcodedTeamLogoOnly, getTeamLogo } from "./teamLogos";

import type { SavedMatchTeam } from "../../types/footballMatch";

const DEFAULT_LOGO = require("../../assets/images/teams/default.png");

/** Resolve the bundled logo first, then the persisted API logo, then the default. */
export const useTeamLogo = (teamName: string, team?: SavedMatchTeam): ImageSourcePropType => {
  const hasTeamName = Boolean(teamName && teamName.trim());
  const hardcodedLogo = hasTeamName
    ? getHardcodedTeamLogoOnly(teamName)
    : null;
  const remoteUrl = team?.logoUrl;
  const { data: persistedLogo } = useQuery({
    queryKey: ["team-logo", teamName],
    enabled: hasTeamName && !hardcodedLogo && !team?.sourceTeamId && !remoteUrl,
    queryFn: async () => {
      try {
        return await getTeamLogo(teamName);
      } catch (error) {
        console.error(`Error loading persisted logo for ${teamName}:`, error);
        return null;
      }
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: "always",
  });

  if (hardcodedLogo) return hardcodedLogo;
  if (remoteUrl) return { uri: remoteUrl };
  return persistedLogo ? { uri: persistedLogo } : DEFAULT_LOGO;
};
