import { Ionicons } from "@expo/vector-icons";
import React from "react";

type AppIconName =
  | "add"
  | "add-circle"
  | "arrow-back"
  | "arrow-down"
  | "arrow-forward"
  | "arrow-up"
  | "beer"
  | "beer-outline"
  | "calendar"
  | "calendar-outline"
  | "chevron-down"
  | "chevron-forward"
  | "close-circle"
  | "close-circle-outline"
  | "flame"
  | "flash-outline"
  | "football"
  | "football-outline"
  | "funnel-outline"
  | "game-controller-outline"
  | "git-network"
  | "home"
  | "options-outline"
  | "people"
  | "people-outline"
  | "person-circle-outline"
  | "play"
  | "remove"
  | "time"
  | "time-outline"
  | "trash-outline"
  | "trophy"
  | "tv-outline";

interface AppIconProps {
  name: AppIconName;
  size: number;
  color: string;
  style?: any;
}

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICON_MAP: Record<AppIconName, IoniconName> = {
  add: "add",
  "add-circle": "add-circle",
  "arrow-back": "arrow-back",
  "arrow-down": "arrow-down",
  "arrow-forward": "arrow-forward",
  "arrow-up": "arrow-up",
  beer: "beer",
  "beer-outline": "beer-outline",
  calendar: "calendar",
  "calendar-outline": "calendar-outline",
  "chevron-down": "chevron-down",
  "chevron-forward": "chevron-forward",
  "close-circle": "close-circle",
  "close-circle-outline": "close-circle-outline",
  flame: "flame",
  "flash-outline": "flash-outline",
  football: "football",
  "football-outline": "football-outline",
  "funnel-outline": "funnel-outline",
  "game-controller-outline": "game-controller-outline",
  "git-network": "git-network",
  home: "home",
  "options-outline": "options-outline",
  people: "people",
  "people-outline": "people-outline",
  "person-circle-outline": "person-circle-outline",
  play: "play",
  remove: "remove",
  time: "time",
  "time-outline": "time-outline",
  "trash-outline": "trash-outline",
  trophy: "trophy",
  "tv-outline": "tv-outline",
};

export type { AppIconName };

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size,
  color,
  style,
}) => {
  const iconName = ICON_MAP[name];

  return <Ionicons name={iconName} size={size} color={color} style={style} />;
};

export default AppIcon;
