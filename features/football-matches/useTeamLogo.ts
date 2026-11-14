import { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import type { SavedMatchTeam } from "../../types/footballMatch";
import { getHardcodedTeamLogoOnly, getTeamLogo } from "./teamLogos";

const DEFAULT_LOGO = require("../../assets/images/teams/default.png");

/** Resolve bundled and provider logos before consulting legacy local storage. */
export function useTeamLogo(teamName: string, team?: SavedMatchTeam): ImageSourcePropType {
  const hardcodedLogo = teamName.trim() ? getHardcodedTeamLogoOnly(teamName) : null;
  const remoteUrl = team?.logoUrl;
  const legacyName = !hardcodedLogo && !remoteUrl && !team?.sourceTeamId && teamName.trim()
    ? teamName
    : null;
  const [cached, setCached] = useState<{ name: string; uri: string }>();

  useEffect(() => {
    if (!legacyName) return;
    let active = true;
    void getTeamLogo(legacyName).then(uri => {
      if (active && uri) setCached({ name: legacyName, uri });
    }).catch(error => {
      if (active) console.error(`Error loading persisted logo for ${legacyName}:`, error);
    });
    return () => { active = false; };
  }, [legacyName]);

  if (hardcodedLogo) return hardcodedLogo;
  if (remoteUrl) return { uri: remoteUrl };
  return cached && cached.name === legacyName ? { uri: cached.uri } : DEFAULT_LOGO;
}
