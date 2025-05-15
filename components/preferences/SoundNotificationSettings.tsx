import React from "react";
import { View, Text, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  commonStyles,
  settingsStyles,
  colors,
} from "../../app/style/userPreferencesStyles";

/**
 * @interface SoundNotificationSettingsProps
 * @brief Props for the SoundNotificationSettings component.
 */
interface SoundNotificationSettingsProps {
  /** @brief Whether sound is enabled. */
  soundEnabled: boolean;
  /** @brief Function to set the sound enabled state. */
  setSoundEnabled: (value: boolean) => void;
  /** @brief Whether common match notifications are enabled. */
  commonMatchNotificationsEnabled: boolean;
  /** @brief Function to set the common match notifications enabled state. */
  setCommonMatchNotificationsEnabled: (value: boolean) => void;
}

/**
 * @brief SoundNotificationSettings component.
 *
 * Displays settings related to sound and notifications, allowing users to
 * toggle sound effects and common match notifications.
 *
 * @param {SoundNotificationSettingsProps} props - The props for the component.
 * @returns {JSX.Element} The rendered SoundNotificationSettings component.
 */
const SoundNotificationSettings: React.FC<SoundNotificationSettingsProps> = ({
  soundEnabled,
  setSoundEnabled,
  commonMatchNotificationsEnabled,
  setCommonMatchNotificationsEnabled,
}) => {
  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>Sound & Notifications</Text>

      <View style={commonStyles.card}>
        <View style={settingsStyles.preferenceRow}>
          <View style={settingsStyles.labelContainer}>
            <Ionicons
              name="volume-high-outline"
              size={22}
              color={colors.textMuted}
              style={settingsStyles.prefIcon}
            />
            <Text style={settingsStyles.preferenceLabel}>Enable Sound</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={(value) => setSoundEnabled(value)}
            trackColor={{
              false: colors.switchTrackOff,
              true: colors.switchTrackOn,
            }}
            thumbColor={soundEnabled ? colors.thumbOn : colors.thumbOff}
            ios_backgroundColor={colors.switchTrackOff}
          />
        </View>

        <View style={settingsStyles.preferenceRow}>
          <View style={settingsStyles.labelContainer}>
            <Ionicons
              name="football-outline"
              size={22}
              color={colors.textMuted}
              style={settingsStyles.prefIcon}
            />
            <Text style={settingsStyles.preferenceLabel}>
              Common Match Notifications
            </Text>
          </View>
          <Switch
            value={commonMatchNotificationsEnabled}
            onValueChange={(value) => setCommonMatchNotificationsEnabled(value)}
            trackColor={{
              false: colors.switchTrackOff,
              true: colors.switchTrackOn,
            }}
            thumbColor={
              commonMatchNotificationsEnabled ? colors.thumbOn : colors.thumbOff
            }
            ios_backgroundColor={colors.switchTrackOff}
          />
        </View>
      </View>
    </View>
  );
};

export default SoundNotificationSettings;
