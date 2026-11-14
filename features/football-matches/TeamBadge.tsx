import { useState } from "react";
import { Image, type ImageProps, type ImageSourcePropType } from "react-native";
import type { SavedMatchTeam } from "../../types/footballMatch";
import { useTeamLogo } from "./useTeamLogo";

interface TeamBadgeProps extends Omit<ImageProps, "source" | "onError"> {
  teamName: string;
  team?: SavedMatchTeam;
}

const fallback = require("../../assets/images/teams/default.png");

export function TeamBadge({ teamName, team, ...props }: TeamBadgeProps) {
  const source = useTeamLogo(teamName, team);
  const key = typeof source === "object" && "uri" in source ? source.uri : String(source);
  return <BadgeImage key={key} source={source} {...props} />;
}

function BadgeImage({ source, ...props }: Omit<ImageProps, "source"> & { source: ImageSourcePropType }) {
  const [failed, setFailed] = useState(false);
  return <Image resizeMode="contain" {...props} source={failed ? fallback : source} onError={() => setFailed(true)} />;
}
