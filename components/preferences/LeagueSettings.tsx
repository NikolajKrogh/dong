import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  commonStyles,
  settingsStyles,
  colors,
} from "../../app/style/userPreferencesStyles";
import { LeagueEndpoint } from "../../constants/leagues";
import ManageLeaguesModal from "./ManageLeaguesModal";
import AddLeagueModal from "./AddLeagueModal";

/**
 * @interface LeagueSettingsProps
 * @brief Props for the LeagueSettings component.
 */
interface LeagueSettingsProps {
  /** @brief Array of configured leagues. */
  configuredLeagues: LeagueEndpoint[];
  /** @brief Function to remove a league. */
  removeLeague: (code: string) => void;
  /** @brief Function to reset leagues to their default settings. */
  resetLeaguesToDefaults: () => void;
  /** @brief Function to add selected leagues to the configured leagues. */
  addLeagues: (leagues: LeagueEndpoint[]) => void;
}

/**
 * @brief LeagueSettings component.
 *
 * Displays settings related to football leagues.
 * Provides two separate settings:
 * 1. Manage Leagues - View and remove configured leagues
 * 2. Add Leagues - Add new leagues to the configuration
 *
 * @param {LeagueSettingsProps} props - The props for the component.
 * @returns {JSX.Element} The rendered LeagueSettings component.
 */
const LeagueSettings: React.FC<LeagueSettingsProps> = ({
  configuredLeagues,
  removeLeague,
  resetLeaguesToDefaults,
  addLeagues,
}) => {
  // State for managing the visibility of modals
  const [manageLeaguesModalVisible, setManageLeaguesModalVisible] =
    useState(false);
  const [addLeagueModalVisible, setAddLeagueModalVisible] = useState(false);

  // State for AddLeagueModal
  const [selectedLeagues, setSelectedLeagues] = useState<LeagueEndpoint[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * @brief Toggles the selection state of a league in the Add League modal.
   * @param {LeagueEndpoint} league - The league to toggle.
   */
  const toggleLeagueSelection = (league: LeagueEndpoint) => {
    setSelectedLeagues((prev) => {
      const isSelected = prev.some((l) => l.code === league.code);
      if (isSelected) {
        return prev.filter((l) => l.code !== league.code);
      } else {
        return [...prev, league];
      }
    });
  };

  /**
   * @brief Handles adding the selected leagues to the configured leagues.
   */
  const handleAddSelectedLeagues = () => {
    addLeagues(selectedLeagues);
    setSelectedLeagues([]);
    setAddLeagueModalVisible(false);
  };

  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>League Settings</Text>

      <View style={commonStyles.card}>
        {/* Manage Leagues Setting */}
        <View style={settingsStyles.preferenceRow}>
          <View style={settingsStyles.labelContainer}>
            <Ionicons
              name="list-outline"
              size={22}
              color={colors.textMuted}
              style={settingsStyles.prefIcon}
            />
            <Text style={settingsStyles.preferenceLabel}>Manage Leagues</Text>
          </View>
          <TouchableOpacity
            style={settingsStyles.manageButton}
            onPress={() => setManageLeaguesModalVisible(true)}
          >
            <Text style={settingsStyles.manageButtonText}>Manage</Text>
          </TouchableOpacity>
        </View>

        {/* Add Leagues Setting */}
        <View style={settingsStyles.preferenceRow}>
          <View style={settingsStyles.labelContainer}>
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={colors.textMuted}
              style={settingsStyles.prefIcon}
            />
            <Text style={settingsStyles.preferenceLabel}>Add Leagues</Text>
          </View>
          <TouchableOpacity
            style={settingsStyles.manageButton}
            onPress={() => setAddLeagueModalVisible(true)}
          >
            <Text style={settingsStyles.manageButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Manage Leagues Modal */}
      <ManageLeaguesModal
        visible={manageLeaguesModalVisible}
        onClose={() => setManageLeaguesModalVisible(false)}
        configuredLeagues={configuredLeagues}
        removeLeague={removeLeague}
        resetLeaguesToDefaults={resetLeaguesToDefaults}
      />

      {/* Add League Modal */}
      <AddLeagueModal
        visible={addLeagueModalVisible}
        onClose={() => {
          setSelectedLeagues([]);
          setSearchQuery("");
          setAddLeagueModalVisible(false);
        }}
        configuredLeagues={configuredLeagues}
        selectedLeagues={selectedLeagues}
        setSelectedLeagues={setSelectedLeagues}
        toggleLeagueSelection={toggleLeagueSelection}
        handleAddSelectedLeagues={handleAddSelectedLeagues}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </View>
  );
};

export default LeagueSettings;