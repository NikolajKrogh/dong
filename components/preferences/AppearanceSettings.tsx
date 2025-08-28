/**
 * @file AppearanceSettings.tsx
 * @description Presents the user preference UI for switching between light and dark themes.
 * Uses the global Zustand store (`useGameStore`) to persist the selected theme across app sessions.
 * The switch reflects the current theme and toggles it with immediate UI feedback.
 */
import React from "react";
import { View, Text, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { useGameStore } from "../../store/store";
import { useColors } from "../../app/style/theme";

/**
 * AppearanceSettings component
 *
 * Renders a settings section containing a single row that lets the user toggle
 * between light and dark mode. The current theme value is sourced from the
 * global store and updated via `setTheme`. Styles are generated from the
 * theme-aware color palette to ensure proper adaptation to both modes.
 *
 * UI structure:
 *  - Section title ("Appearance")
 *  - Card container with one preference row
 *  - Row contains: icon + label on the left, theme switch on the right
 *
 * @returns {JSX.Element} The rendered appearance settings section.
 */
const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useGameStore();
  const colors = useColors();
  const { commonStyles, settingsStyles: styles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );

  /**
   * Toggles the theme based on the Switch value.
   * @param enabled When true selects the dark theme; otherwise selects the light theme.
   */
  const toggleTheme = (enabled: boolean) =>
    setTheme(enabled ? "dark" : "light");

  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>Appearance</Text>
      <View style={commonStyles.card}>
        <View style={styles.preferenceRow}>
          <View style={styles.labelContainer}>
            <Ionicons
              name="moon-outline"
              size={22}
              color={colors.textMuted}
              style={styles.prefIcon}
            />
            <Text style={styles.preferenceLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={theme === "dark"}
            onValueChange={toggleTheme}
            trackColor={{
              false: colors.switchTrackOff,
              true: colors.switchTrackOn,
            }}
            thumbColor={theme === "dark" ? colors.thumbOn : colors.thumbOff}
            ios_backgroundColor={colors.switchTrackOff}
          />
        </View>
      </View>
    </View>
  );
};

export default AppearanceSettings;
