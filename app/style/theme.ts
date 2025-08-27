import { colors as base } from "./palette";
import { useGameStore } from "../../store/store";

export type ThemeName = "light" | "dark";

// Light palette is the existing palette
export const lightColors = base;

// Dark palette derived from base with sensible contrasts
export const darkColors = {
  ...base,
  background: "#0e1116",
  backgroundLight: "#12161c",
  backgroundSubtle: "#161b22",
  surface: "#1b222c",
  darkSurface: "#0e1116",
  textPrimary: "#e6edf3",
  textSecondary: "#c9d1d9",
  textMuted: "#8b949e",
  textDisabled: "#6e7681",
  border: "#2d333b",
  borderLight: "#30363d",
  borderLighter: "#343a42",
  borderSubtle: "#2d333b",
  primaryLight: "#0b2947",
  primaryLighter: "#0a223a",
  primaryDark: "#58a6ff",
  primaryTransparentLight: "rgba(88, 166, 255, 0.12)",
  successLight: "#12361c",
  dangerLight: "#3b1519",
  warningLight: "#3b2e0d",
  infoLight: "#11343a",
  toastBackground: "#0d1117",
  playerItemOddBackground: "#151b23",
};

export const useColors = () => {
  const theme = useGameStore((s) => s.theme);
  return theme === "dark" ? darkColors : lightColors;
};

// Non-hook accessor for colors, safe to call outside React components
export const getCurrentColors = () => {
  const theme = useGameStore.getState().theme;
  return theme === "dark" ? darkColors : lightColors;
};

// Dummy default export to satisfy Expo Router if this file is treated as a route
export default function StyleThemeRoute() {
  return null;
}
