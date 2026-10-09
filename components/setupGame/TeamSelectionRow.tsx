import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  type GestureResponderEvent,
  type ListRenderItemInfo,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";

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

interface TeamPickerModalProps {
  testID: string;
  placeholder: string;
  visible: boolean;
  options: TeamOptionWithLeague[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onClose: () => void;
  onSelect: (team: string) => void;
  onAdd: () => void;
  styles: ReturnType<typeof createSetupGameStyles>;
}

interface TeamOptionRowProps {
  item: TeamOptionWithLeague;
  onSelect: (team: string) => void;
  styles: ReturnType<typeof createSetupGameStyles>;
}

interface TeamSelectionFieldProps {
  team: string;
  placeholder: string;
  onOpen: () => void;
  onClear: (event: GestureResponderEvent) => void;
  styles: ReturnType<typeof createSetupGameStyles>;
  colors: ReturnType<typeof useColors>;
}

const teamOptionKeyExtractor = (item: TeamOptionWithLeague) => item.key;

const TeamSelectionField = ({
  team,
  placeholder,
  onOpen,
  onClear,
  styles,
  colors,
}: TeamSelectionFieldProps) => (
  <View style={styles.teamInputWrapper}>
    <TouchableOpacity
      style={[styles.teamSearchField, team ? styles.teamSearchFieldSelected : null]}
      onPress={onOpen}
      activeOpacity={0.7}
    >
      <Ionicons
        name="search-outline"
        size={20}
        color={team ? colors.primary : colors.textMuted}
        style={styles.teamSearchIcon}
      />
      <Text
        style={[
          styles.teamSearchText,
          team ? styles.teamSearchTextSelected : styles.teamSearchTextPlaceholder,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {team || placeholder}
      </Text>
      {!!team && (
        <TouchableOpacity style={styles.teamClearButton} onPress={onClear}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  </View>
);

const TeamOptionRow = React.memo(function TeamOptionRow({
  item,
  onSelect,
  styles,
}: TeamOptionRowProps) {
  const handlePress = useCallback(
    () => onSelect(item.value),
    [item.value, onSelect],
  );

  return (
    <TouchableOpacity style={styles.modalItem} onPress={handlePress}>
      <Text style={styles.modalItemText}>{item.displayName || item.value}</Text>
    </TouchableOpacity>
  );
});

const TeamPickerModal = ({
  testID,
  placeholder,
  visible,
  options,
  searchTerm,
  setSearchTerm,
  onClose,
  onSelect,
  onAdd,
  styles,
}: TeamPickerModalProps) => {
  const renderOption = useCallback(
    ({ item }: ListRenderItemInfo<TeamOptionWithLeague>) => (
      <TeamOptionRow item={item} onSelect={onSelect} styles={styles} />
    ),
    [onSelect, styles],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView testID={testID} style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder={placeholder}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoFocus
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={teamOptionKeyExtractor}
            renderItem={renderOption}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>No teams found</Text>
                {!!searchTerm.trim() && (
                  <TouchableOpacity style={styles.addNewButton} onPress={onAdd}>
                    <Text style={styles.addNewButtonText}>
                      Add &quot;{searchTerm}&quot;
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListFooterComponent={
              options.length > 0 && searchTerm ? (
                <TouchableOpacity style={styles.addNewButton} onPress={onAdd}>
                  <Text style={styles.addNewButtonText}>
                    Add &quot;{searchTerm}&quot; as new team
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

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

  const filteredHomeOptions = homeTeamOptions.filter((item) =>
    item.value.toLowerCase().includes(homeSearchTerm.toLowerCase()),
  );
  const filteredAwayOptions = awayTeamOptions.filter((item) =>
    item.value.toLowerCase().includes(awaySearchTerm.toLowerCase()),
  );

  /**
   * Whether the add button is disabled.
   * @description Becomes enabled only when both teams have been selected.
   */
  const isAddButtonDisabled = !homeTeam || !awayTeam;


  /**
   * Selects a home team and resets related UI state.
   * @description Sets chosen team, clears search input and closes the modal.
   * @param team Team name.
   */
  const selectHomeTeam = useCallback((team: string) => {
    setHomeTeam(team);
    setHomeSearchTerm("");
    setShowHomeDropdown(false);
  }, [setHomeTeam]);

  /**
   * Selects an away team and resets related UI state.
   * @description Sets chosen team, clears search input and closes the modal.
   * @param team Team name.
   */
  const selectAwayTeam = useCallback((team: string) => {
    setAwayTeam(team);
    setAwaySearchTerm("");
    setShowAwayDropdown(false);
  }, [setAwayTeam]);

  /**
   * Adds a new custom home team then selects it.
   * @description No-op if the trimmed search term is empty.
   */
  const handleAddHomeTeam = useCallback(() => {
    if (homeSearchTerm.trim()) {
      addNewHomeTeam(homeSearchTerm.trim());
      selectHomeTeam(homeSearchTerm.trim());
    }
  }, [addNewHomeTeam, homeSearchTerm, selectHomeTeam]);

  /**
   * Adds a new custom away team then selects it.
   * @description No-op if the trimmed search term is empty.
   */
  const handleAddAwayTeam = useCallback(() => {
    if (awaySearchTerm.trim()) {
      addNewAwayTeam(awaySearchTerm.trim());
      selectAwayTeam(awaySearchTerm.trim());
    }
  }, [addNewAwayTeam, awaySearchTerm, selectAwayTeam]);

  const openHomeDropdown = useCallback(() => {
    setShowHomeDropdown(true);
    setShowAwayDropdown(false);
  }, []);
  const openAwayDropdown = useCallback(() => {
    setShowAwayDropdown(true);
    setShowHomeDropdown(false);
  }, []);
  const closeHomeDropdown = useCallback(() => setShowHomeDropdown(false), []);
  const closeAwayDropdown = useCallback(() => setShowAwayDropdown(false), []);
  const clearHomeTeam = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    setHomeTeam("");
    setHomeSearchTerm("");
  }, [setHomeTeam]);
  const clearAwayTeam = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    setAwayTeam("");
    setAwaySearchTerm("");
  }, [setAwayTeam]);

  return (
    <View>
      {/* Team Selection Input Row */}
      <View style={styles.inputRow}>
        <TeamSelectionField
          team={homeTeam}
          placeholder="Home Team"
          onOpen={openHomeDropdown}
          onClear={clearHomeTeam}
          styles={styles}
          colors={colors}
        />

        {/* VS Text Separator */}
        <Text style={styles.vsText}>vs</Text>

        <TeamSelectionField
          team={awayTeam}
          placeholder="Away Team"
          onOpen={openAwayDropdown}
          onClear={clearAwayTeam}
          styles={styles}
          colors={colors}
        />

        {/* Add Match Button */}
        <TouchableOpacity
          accessibilityLabel="Add Match"
          testID="SetupAddMatchButton"
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

      <TeamPickerModal
        testID="SetupHomeTeamModal"
        placeholder="Search home"
        visible={showHomeDropdown}
        options={filteredHomeOptions}
        searchTerm={homeSearchTerm}
        setSearchTerm={setHomeSearchTerm}
        onClose={closeHomeDropdown}
        onSelect={selectHomeTeam}
        onAdd={handleAddHomeTeam}
        styles={styles}
      />
      <TeamPickerModal
        testID="SetupAwayTeamModal"
        placeholder="Search away"
        visible={showAwayDropdown}
        options={filteredAwayOptions}
        searchTerm={awaySearchTerm}
        setSearchTerm={setAwaySearchTerm}
        onClose={closeAwayDropdown}
        onSelect={selectAwayTeam}
        onAdd={handleAddAwayTeam}
        styles={styles}
      />
    </View>
  );
};

export default TeamSelectionRow;
