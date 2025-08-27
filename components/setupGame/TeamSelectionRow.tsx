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
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import { Ionicons } from "@expo/vector-icons";

/**
 * Represents a selectable team option including optional league metadata.
 * @description Used to populate the home/away team pickers; displayName holds a cleaned version of value for UI.
 */
interface TeamOptionWithLeague {
  key: string;
  value: string;
  league?: string;
  displayName?: string;
}

/**
 * Props for the TeamSelectionRow component.
 * @description Provides current selections, option lists and callbacks for updating or adding teams and finalizing a match.
 * @property homeTeam Current home team name.
 * @property awayTeam Current away team name.
 * @property setHomeTeam Setter for home team.
 * @property setAwayTeam Setter for away team.
 * @property homeTeamOptions Options available for home side.
 * @property awayTeamOptions Options available for away side.
 * @property handleAddMatchAndClear Adds the match then resets fields.
 * @property addNewHomeTeam Adds a new custom home team.
 * @property addNewAwayTeam Adds a new custom away team.
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
 * Row UI for selecting and optionally creating home and away teams.
 * @description Renders two searchable modal pickers (home/away), supports free‑text addition of new teams, and an add‑match button once both sides are selected.
 * @param props Component props.
 * @returns JSX element.
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
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  /**
   * Current search text for filtering home team options.
   * @description Cleared after a selection or when the clear icon is pressed.
   */
  const [homeSearchTerm, setHomeSearchTerm] = useState("");

  /**
   * Current search text for filtering away team options.
   * @description Cleared after a selection or when the clear icon is pressed.
   */
  const [awaySearchTerm, setAwaySearchTerm] = useState("");

  /** Flag controlling visibility of the home team modal. */
  const [showHomeDropdown, setShowHomeDropdown] = useState(false);

  /** Flag controlling visibility of the away team modal. */
  const [showAwayDropdown, setShowAwayDropdown] = useState(false);

  /** Filtered home team options derived from search term. */
  const [filteredHomeOptions, setFilteredHomeOptions] =
    useState(homeTeamOptions);

  /** Filtered away team options derived from search term. */
  const [filteredAwayOptions, setFilteredAwayOptions] =
    useState(awayTeamOptions);

  /**
   * Whether the add button is disabled.
   * @description Becomes enabled only when both teams have been selected.
   */
  const isAddButtonDisabled = !homeTeam || !awayTeam;

  /**
   * Filters the home team list when the search term changes.
   * @description Updates filteredHomeOptions with matches or resets to full list when cleared.
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
   * Filters the away team list when the search term changes.
   * @description Updates filteredAwayOptions with matches or resets to full list when cleared.
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
   * Selects a home team and resets related UI state.
   * @description Sets chosen team, clears search input and closes the modal.
   * @param team Team name.
   */
  const selectHomeTeam = (team: string) => {
    setHomeTeam(team);
    setHomeSearchTerm("");
    setShowHomeDropdown(false);
  };

  /**
   * Selects an away team and resets related UI state.
   * @description Sets chosen team, clears search input and closes the modal.
   * @param team Team name.
   */
  const selectAwayTeam = (team: string) => {
    setAwayTeam(team);
    setAwaySearchTerm("");
    setShowAwayDropdown(false);
  };

  /**
   * Adds a new custom home team then selects it.
   * @description No-op if the trimmed search term is empty.
   */
  const handleAddHomeTeam = () => {
    if (homeSearchTerm.trim()) {
      addNewHomeTeam(homeSearchTerm.trim());
      selectHomeTeam(homeSearchTerm.trim());
    }
  };

  /**
   * Adds a new custom away team then selects it.
   * @description No-op if the trimmed search term is empty.
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
