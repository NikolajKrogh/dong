import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  commonStyles,
  settingsStyles,
} from "../../app/style/userPreferencesStyles";
import { LeagueEndpoint } from "../../constants/leagues";

/**
 * @interface DataSourcesSettingsProps
 * @brief Props for the DataSourcesSettings component.
 */
interface DataSourcesSettingsProps {
  /** @brief Array of configured leagues. */
  configuredLeagues: LeagueEndpoint[];
  /** @brief Function to call when the "Manage Leagues" button is pressed. */
  onManageLeagues: () => void;
}

/**
 * @brief DataSourcesSettings component.
 *
 * Displays settings related to data sources, specifically football leagues.
 * Allows users to view the number of configured leagues and navigate to manage them.
 *
 * @param {DataSourcesSettingsProps} props - The props for the component.
 * @returns {JSX.Element} The rendered DataSourcesSettings component.
 */
const DataSourcesSettings: React.FC<DataSourcesSettingsProps> = ({
  configuredLeagues,
  onManageLeagues,
}) => {
  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>Data Sources</Text>

      <View style={commonStyles.card}>
        <View style={settingsStyles.preferenceRow}>
          <View style={settingsStyles.labelContainer}>
            <Ionicons
              name="football"
              size={22}
              color="#555"
              style={settingsStyles.prefIcon}
            />
            <View style={{ flex: 1 }}>
              <Text style={settingsStyles.preferenceLabel}>
                Football Leagues
              </Text>
              <Text style={settingsStyles.leaguesSummary}>
                {configuredLeagues.length} leagues configured
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={settingsStyles.manageButton}
            onPress={onManageLeagues}
          >
            <Text style={settingsStyles.manageButtonText}>Manage</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default DataSourcesSettings;