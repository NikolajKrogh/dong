import React from "react";
import { View, Text, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { useColors } from "../../app/style/theme";
import { ShellSection, ShellCard } from "../ui";

/**
 * Props for sound + notification settings.
 * @description Holds toggles for sound effects and common match notifications.
 */
interface SoundNotificationSettingsProps {
  /** Whether sound is enabled. */
  soundEnabled: boolean;
  /** Setter for sound enabled state. */
  setSoundEnabled: (value: boolean) => void;
  /** Whether common match notifications are enabled. */
  commonMatchNotificationsEnabled: boolean;
  /** Setter for common match notifications state. */
  setCommonMatchNotificationsEnabled: (value: boolean) => void;
}

/**
 * Sound & notification settings.
 * @description Allows toggling sound effects and common match notification feature.
 * @param {SoundNotificationSettingsProps} props Component props.
 * @returns {JSX.Element} Card element.
 */
const SoundNotificationSettings: React.FC<SoundNotificationSettingsProps> = ({
  soundEnabled,
  setSoundEnabled,
  commonMatchNotificationsEnabled,
  setCommonMatchNotificationsEnabled,
}) => {
  const colors = useColors();
  const { settingsStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  return (
    <ShellSection title="Sound & Notifications" marginBottom="$3">
      <ShellCard compact>
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

        <View
          style={[
            settingsStyles.preferenceRow,
            settingsStyles.preferenceRowLast,
          ]}
        >
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
      </ShellCard>
    </ShellSection>
  );
};

export default SoundNotificationSettings;
