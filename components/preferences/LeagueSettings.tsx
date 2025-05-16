import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LeagueEndpoint } from "../../constants/leagues";
import { Ionicons } from "@expo/vector-icons";
import {
  settingsStyles,
  commonStyles,
  colors,
} from "../../app/style/userPreferencesStyles";

interface LeagueSettingsProps {
  configuredLeagues: LeagueEndpoint[];
  onManageLeaguesPress: () => void;
  onAddLeaguesPress: () => void;
  defaultSelectedLeagues: LeagueEndpoint[];
  onSetDefaultLeaguesPress: () => void;
}

const SettingsRow: React.FC<{
  label: string;
  value?: string;
  onPress: () => void;
  iconName: keyof typeof Ionicons.glyphMap;
  valueIsSecondary?: boolean;
}> = ({ label, value, onPress, iconName, valueIsSecondary }) => (
  <TouchableOpacity onPress={onPress} style={settingsStyles.preferenceRow}>
    <View style={settingsStyles.labelContainer}>
      {/* @ts-ignore */}
      <Ionicons
        name={iconName}
        size={22}
        color={colors.secondary}
        style={settingsStyles.prefIcon}
      />
      <Text style={settingsStyles.preferenceLabel}>{label}</Text>
    </View>
    {value && (
      <Text
        style={[
          { fontSize: 14, color: colors.textMuted },
          valueIsSecondary && { fontStyle: "italic" },
        ]}
      >
        {value}
      </Text>
    )}
  </TouchableOpacity>
);

const LeagueSettings: React.FC<LeagueSettingsProps> = ({
  configuredLeagues,
  onManageLeaguesPress,
  onAddLeaguesPress,
  defaultSelectedLeagues,
  onSetDefaultLeaguesPress,
}) => {
  const configuredLeagueCount = configuredLeagues.length;

  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>League Configuration</Text>
      <View style={commonStyles.card}>
        <SettingsRow
          label="Manage Configured Leagues"
          iconName="list-outline"
          value={`${configuredLeagueCount} league${
            configuredLeagueCount === 1 ? "" : "s"
          }`}
          onPress={onManageLeaguesPress}
        />
        <SettingsRow
          label="Add New Leagues"
          iconName="add-circle-outline"
          onPress={onAddLeaguesPress}
        />
        <SettingsRow
          label="Set Default Leagues"
          iconName="star-outline"
          value={
            defaultSelectedLeagues.length > 0
              ? `${defaultSelectedLeagues.length} selected`
              : "Tap to set"
          }
          onPress={onSetDefaultLeaguesPress}
          valueIsSecondary={defaultSelectedLeagues.length === 0}
        />
      </View>
    </View>
  );
};

export default LeagueSettings;
