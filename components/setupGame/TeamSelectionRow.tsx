import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  SafeAreaView,
} from "react-native";
import styles, { colors } from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";

/**
 * @brief Interface for a team option with its league information.
 * 
 * @property key Unique identifier for the team option.
 * @property value Original full team name.
 * @property league Optional league the team belongs to.
 * @property displayName Optional normalized team name for display without prefixes/suffixes.
 */
interface TeamOptionWithLeague {
  key: string;
  value: string;
  league?: string;
  displayName?: string;
}

/**
 * @brief Interface for the props of the TeamSelectionRow component.
 * 
 * @property homeTeam Currently selected home team name.
 * @property awayTeam Currently selected away team name.
 * @property setHomeTeam Function to update the home team selection.
 * @property setAwayTeam Function to update the away team selection.
 * @property homeTeamOptions Array of team options for home team selection.
 * @property awayTeamOptions Array of team options for away team selection.
 * @property handleAddMatchAndClear Function to add the selected match and clear the form.
 * @property addNewHomeTeam Function to add a new home team to the available options.
 * @property addNewAwayTeam Function to add a new away team to the available options.
 */
interface TeamSelectionRowProps {
  homeTeam: string;
  awayTeam: string;
  setHomeTeam: (team: string) => void;
  setAwayTeam: (team: string) => void;
  homeTeamOptions: TeamOptionWithLeague[];
  awayTeamOptions: TeamOptionWithLeague[];
  handleAddMatchAndClear: () => void;
  addNewHomeTeam: (team: string) => void;
  addNewAwayTeam: (team: string) => void;
}

/**
 * @brief Component for selecting home and away teams.
 *
 * This component renders a row of input fields for selecting the home and away teams.
 * It provides modal dropdowns with searchable team options and allows adding new teams.
 * The component supports:
 * - Displaying team options with normalized names (without prefixes/suffixes)
 * - Searching for teams by name
 * - Adding new custom teams when no matches are found
 * - Visual feedback for selected teams
 *
 * @param props The props for the component.
 * @returns A React functional component.
 */
const TeamSelectionRow: React.FC<TeamSelectionRowProps> = ({
  homeTeam,
  awayTeam,
  setHomeTeam,
  setAwayTeam,
  homeTeamOptions,
  awayTeamOptions,
  handleAddMatchAndClear,
  addNewHomeTeam,
  addNewAwayTeam,
}) => {
  /**
   * @brief Current search term for filtering home teams.
   */
  const [homeSearchTerm, setHomeSearchTerm] = useState("");
  
  /**
   * @brief Current search term for filtering away teams.
   */
  const [awaySearchTerm, setAwaySearchTerm] = useState("");
  
  /**
   * @brief Flag to control visibility of the home team selection modal.
   */
  const [showHomeDropdown, setShowHomeDropdown] = useState(false);
  
  /**
   * @brief Flag to control visibility of the away team selection modal.
   */
  const [showAwayDropdown, setShowAwayDropdown] = useState(false);
  
  /**
   * @brief Filtered list of home team options based on search term.
   */
  const [filteredHomeOptions, setFilteredHomeOptions] =
    useState(homeTeamOptions);
  
  /**
   * @brief Filtered list of away team options based on search term.
   */
  const [filteredAwayOptions, setFilteredAwayOptions] =
    useState(awayTeamOptions);

  /**
   * @brief Flag indicating whether the add button should be disabled.
   * 
   * The button is disabled when either home team or away team is not selected.
   */
  const isAddButtonDisabled = !homeTeam || !awayTeam;

  /**
   * @brief Filters home team options when the search term changes.
   *
   * This useEffect hook filters the home team options based on the current search term.
   * It updates the filteredHomeOptions state with the matching teams.
   */
  useEffect(() => {
    if (homeSearchTerm) {
      const filtered = homeTeamOptions.filter((item) =>
        item.value.toLowerCase().includes(homeSearchTerm.toLowerCase())
      );
      setFilteredHomeOptions(filtered);
    } else {
      setFilteredHomeOptions(homeTeamOptions);
    }
  }, [homeSearchTerm, homeTeamOptions]);

  /**
   * @brief Filters away team options when the search term changes.
   *
   * This useEffect hook filters the away team options based on the current search term.
   * It updates the filteredAwayOptions state with the matching teams.
   */
  useEffect(() => {
    if (awaySearchTerm) {
      const filtered = awayTeamOptions.filter((item) =>
        item.value.toLowerCase().includes(awaySearchTerm.toLowerCase())
      );
      setFilteredAwayOptions(filtered);
    } else {
      setFilteredAwayOptions(awayTeamOptions);
    }
  }, [awaySearchTerm, awayTeamOptions]);

  /**
   * @brief Selects the home team and closes the dropdown.
   *
   * This function sets the selected home team, clears the search term, and closes the dropdown.
   *
   * @param team The name of the home team to select.
   */
  const selectHomeTeam = (team: string) => {
    setHomeTeam(team);
    setHomeSearchTerm("");
    setShowHomeDropdown(false);
  };

  /**
   * @brief Selects the away team and closes the dropdown.
   *
   * This function sets the selected away team, clears the search term, and closes the dropdown.
   *
   * @param team The name of the away team to select.
   */
  const selectAwayTeam = (team: string) => {
    setAwayTeam(team);
    setAwaySearchTerm("");
    setShowAwayDropdown(false);
  };

  /**
   * @brief Adds and selects a new home team.
   *
   * This function adds a new home team to the list of available teams and selects it.
   * It validates that the search term is not empty before adding.
   */
  const handleAddHomeTeam = () => {
    if (homeSearchTerm.trim()) {
      addNewHomeTeam(homeSearchTerm.trim());
      selectHomeTeam(homeSearchTerm.trim());
    }
  };

  /**
   * @brief Adds and selects a new away team.
   *
   * This function adds a new away team to the list of available teams and selects it.
   * It validates that the search term is not empty before adding.
   */
  const handleAddAwayTeam = () => {
    if (awaySearchTerm.trim()) {
      addNewAwayTeam(awaySearchTerm.trim());
      selectAwayTeam(awaySearchTerm.trim());
    }
  };

  return (
    <View>
      {/* Team Selection Input Row */}
      <View style={styles.inputRow}>
        {/* Home Team Selection Field */}
        <View style={styles.teamInputWrapper}>
          <TouchableOpacity
            style={[
              styles.teamSearchField,
              homeTeam ? styles.teamSearchFieldSelected : null,
            ]}
            onPress={() => {
              setShowHomeDropdown(true);
              setShowAwayDropdown(false);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={homeTeam ? colors.primary : colors.textMuted}
              style={styles.teamSearchIcon}
            />
            <Text
              style={[
                styles.teamSearchText,
                homeTeam
                  ? styles.teamSearchTextSelected
                  : styles.teamSearchTextPlaceholder,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {homeTeam || "Home Team"}
            </Text>
            {homeTeam && (
              <TouchableOpacity
                style={styles.teamClearButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setHomeTeam("");
                  setHomeSearchTerm("");
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* VS Text Separator */}
        <Text style={styles.vsText}>vs</Text>

        {/* Away Team Selection Field */}
        <View style={styles.teamInputWrapper}>
          <TouchableOpacity
            style={[
              styles.teamSearchField,
              awayTeam ? styles.teamSearchFieldSelected : null,
            ]}
            onPress={() => {
              setShowAwayDropdown(true);
              setShowHomeDropdown(false);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={awayTeam ? colors.primary : colors.textMuted}
              style={styles.teamSearchIcon}
            />
            <Text
              style={[
                styles.teamSearchText,
                awayTeam
                  ? styles.teamSearchTextSelected
                  : styles.teamSearchTextPlaceholder,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {awayTeam || "Away Team"}
            </Text>
            {awayTeam && (
              <TouchableOpacity
                style={styles.teamClearButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setAwayTeam("");
                  setAwaySearchTerm("");
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Add Match Button */}
        <TouchableOpacity
          style={[
            styles.matchAddButton,
            isAddButtonDisabled && styles.matchAddButtonDisabled,
          ]}
          onPress={handleAddMatchAndClear}
          disabled={isAddButtonDisabled}
        >
          <Ionicons
            name="add-circle-outline"
            size={28}
            color={colors.textLight}
          />
        </TouchableOpacity>
      </View>

      {/* Home Team Selection Modal */}
      <Modal
        visible={showHomeDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHomeDropdown(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search home"
                value={homeSearchTerm}
                onChangeText={setHomeSearchTerm}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowHomeDropdown(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredHomeOptions}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => selectHomeTeam(item.value)}
                >
                  <Text style={styles.modalItemText}>
                    {item.displayName || item.value}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>No teams found</Text>
                  {homeSearchTerm.trim() && (
                    <TouchableOpacity
                      style={styles.addNewButton}
                      onPress={handleAddHomeTeam}
                    >
                      <Text style={styles.addNewButtonText}>
                        Add "{homeSearchTerm}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              ListFooterComponent={
                filteredHomeOptions.length > 0 && homeSearchTerm ? (
                  <TouchableOpacity
                    style={styles.addNewButton}
                    onPress={handleAddHomeTeam}
                  >
                    <Text style={styles.addNewButtonText}>
                      Add "{homeSearchTerm}" as new team
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Away Team Selection Modal */}
      <Modal
        visible={showAwayDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAwayDropdown(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search away"
                value={awaySearchTerm}
                onChangeText={setAwaySearchTerm}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowAwayDropdown(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredAwayOptions}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => selectAwayTeam(item.value)}
                >
                  <Text style={styles.modalItemText}>
                    {item.displayName || item.value}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>No teams found</Text>
                  {awaySearchTerm.trim() && (
                    <TouchableOpacity
                      style={styles.addNewButton}
                      onPress={handleAddAwayTeam}
                    >
                      <Text style={styles.addNewButtonText}>
                        Add "{awaySearchTerm}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              ListFooterComponent={
                filteredAwayOptions.length > 0 && awaySearchTerm ? (
                  <TouchableOpacity
                    style={styles.addNewButton}
                    onPress={handleAddAwayTeam}
                  >
                    <Text style={styles.addNewButtonText}>
                      Add "{awaySearchTerm}" as new team
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default TeamSelectionRow;