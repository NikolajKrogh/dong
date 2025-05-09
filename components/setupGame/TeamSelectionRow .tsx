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
import { Ionicons } from "@expo/vector-icons"; // Import Ionicons

/**
 * @brief Interface for a team option with its league information.
 */
interface TeamOptionWithLeague {
  key: string;
  value: string;
  league?: string;
}

/**
 * @brief Interface for the props of the TeamSelectionRow component.
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

/*
 * @brief Component for selecting home and away teams.
 *
 * This component renders a row of input fields for selecting the home and away teams.
 * It provides dropdowns with team options and allows adding new teams.
 *
 * @param props - The props for the component.
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
  const [homeSearchTerm, setHomeSearchTerm] = useState("");
  const [awaySearchTerm, setAwaySearchTerm] = useState("");
  const [showHomeDropdown, setShowHomeDropdown] = useState(false);
  const [showAwayDropdown, setShowAwayDropdown] = useState(false);
  const [filteredHomeOptions, setFilteredHomeOptions] =
    useState(homeTeamOptions);
  const [filteredAwayOptions, setFilteredAwayOptions] =
    useState(awayTeamOptions);

  const isAddButtonDisabled = !homeTeam || !awayTeam;

  /**
   * @brief Filters home team options when the search term changes.
   *
   * This useEffect hook filters the home team options based on the current search term.
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
   * @param team - The name of the home team to select.
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
   * @param team - The name of the away team to select.
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
   */
  const handleAddAwayTeam = () => {
    if (awaySearchTerm.trim()) {
      addNewAwayTeam(awaySearchTerm.trim());
      selectAwayTeam(awaySearchTerm.trim());
    }
  };

  return (
    <View>
      <View style={styles.inputRow}>
        {/* Home Team Selection - Improved UI */}
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

        <Text style={styles.vsText}>vs</Text>

        {/* Away Team Selection - Improved UI */}
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

        {/* Improved Add Button */}
        <TouchableOpacity
          style={[
            styles.matchAddButton, // New style for the add button
            isAddButtonDisabled && styles.matchAddButtonDisabled, // New disabled style
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

      {/* Home Team Modal Dropdown */}
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
                  <Text style={styles.modalItemText}>{item.value}</Text>
                  {/* Removed league display */}
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

      {/* Away Team Modal Dropdown */}
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
                  <Text style={styles.modalItemText}>{item.value}</Text>
                  {/* Removed league display */}
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
