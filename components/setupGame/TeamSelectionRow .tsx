import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SelectList } from "react-native-dropdown-select-list";
import styles from "../../app/style/setupGameStyles";

interface TeamSelectionRowProps {
  homeTeam: string;
  awayTeam: string;
  setHomeTeam: (team: string) => void;
  setAwayTeam: (team: string) => void;
  homeTeamOptions: Array<{ key: string; value: string }>;
  awayTeamOptions: Array<{ key: string; value: string }>;
  handleAddMatchAndClear: () => void;
}

const TeamSelectionRow: React.FC<TeamSelectionRowProps> = ({
  homeTeam,
  awayTeam,
  setHomeTeam,
  setAwayTeam,
  homeTeamOptions,
  awayTeamOptions,
  handleAddMatchAndClear,
}) => {
  const isAddButtonDisabled = !homeTeam || !awayTeam;

  return (
    <View style={styles.inputRow}>
      {/* Home Team Dropdown */}
      <View style={styles.dropdownContainer}>
        <SelectList
          setSelected={(value: string) => setHomeTeam(value)}
          data={homeTeamOptions}
          save="value"
          placeholder="Home Team"
          search={true}
          boxStyles={styles.dropdownBox}
          inputStyles={styles.dropdownInput}
          dropdownStyles={styles.dropdown}
          dropdownItemStyles={styles.dropdownItem}
          dropdownTextStyles={styles.dropdownText}
          maxHeight={150}
          notFoundText="No teams in this time range"
        />
      </View>

      <Text style={styles.vsText}>vs</Text>

      {/* Away Team Dropdown */}
      <View style={styles.dropdownContainer}>
        <SelectList
          setSelected={(value: string) => setAwayTeam(value)}
          data={awayTeamOptions}
          save="value"
          placeholder="Away Team"
          search={true}
          boxStyles={styles.dropdownBox}
          inputStyles={styles.dropdownInput}
          dropdownStyles={styles.dropdown}
          dropdownItemStyles={styles.dropdownItem}
          dropdownTextStyles={styles.dropdownText}
          maxHeight={150}
          notFoundText="No teams in this time range"
        />
      </View>

      <TouchableOpacity
        style={[styles.addButton, isAddButtonDisabled && styles.disabledButton]}
        onPress={handleAddMatchAndClear}
        disabled={isAddButtonDisabled}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TeamSelectionRow;
