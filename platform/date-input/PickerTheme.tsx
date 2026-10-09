import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { en, registerTranslation } from "react-native-paper-dates";
import { useGameStore } from "../../store/store";
import { useColors } from "../../styles/theme";

registerTranslation("en", en);

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  close: "close",
  pencil: "pencil",
  calendar: "calendar-outline",
  "chevron-left": "chevron-back",
  "chevron-right": "chevron-forward",
  "chevron-down": "chevron-down",
  "menu-down": "chevron-down",
  "keyboard-outline": "keypad-outline",
  "clock-outline": "time-outline",
  "alert-circle": "alert-circle-outline",
};
const settings = {
  icon: ({
    name,
    color,
    size,
  }: {
    name: string;
    color?: string;
    size: number;
  }) => (
    <Ionicons
      name={icons[name] ?? "help-circle-outline"}
      color={color}
      size={size}
    />
  ),
};

export function PickerTheme({ children }: { children: React.ReactNode }) {
  const dark = useGameStore((state) => state.theme === "dark");
  const colors = useColors();
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primaryFocus,
      onPrimary: colors.white,
      primaryContainer: colors.primaryLight,
      onPrimaryContainer: colors.textPrimary,
      secondaryContainer: colors.backgroundSubtle,
      onSecondaryContainer: colors.textPrimary,
      background: colors.background,
      onBackground: colors.textPrimary,
      surface: colors.surface,
      onSurface: colors.textPrimary,
      surfaceVariant: colors.backgroundSubtle,
      onSurfaceVariant: colors.textSecondary,
      outline: colors.border,
      error: colors.dangerForeground,
      elevation: {
        ...base.colors.elevation,
        level1: colors.surface,
        level2: colors.surface,
        level3: colors.surface,
        level4: colors.surface,
        level5: colors.surface,
      },
    },
  };
  return (
    <PaperProvider theme={theme} settings={settings}>
      {children}
    </PaperProvider>
  );
}
