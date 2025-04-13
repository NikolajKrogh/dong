import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchesHeaderProps } from "./types";
import styles from "../../../app/style/gameProgressStyles";

/**
 * @brief Header component for the matches grid/list.
 * - Displays the title "Matches".
 * - Provides buttons to open the sort modal and toggle between grid and list layout.
 * @param {MatchesHeaderProps} props - The properties passed to the component.
 * @param {string} props.sortField - The current field used for sorting matches.
 * @param {'asc' | 'desc'} props.sortDirection - The current direction of sorting (ascending or descending).
 * @param {boolean} props.useGridLayout - Indicates whether the grid layout is currently active.
 * @param {(visible: boolean) => void} props.setSortModalVisible - Function to control the visibility of the sort modal.
 * @param {() => void} props.toggleLayoutMode - Function to toggle between grid and list layout modes.
 * @returns {React.ReactElement} The rendered header component.
 */
const MatchesHeader: React.FC<MatchesHeaderProps> = ({
  sortField,
  sortDirection,
  useGridLayout,
  setSortModalVisible,
  toggleLayoutMode,
}) => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Matches</Text>

      <View style={styles.headerButtons}>
        {/* Sort button */}
        <TouchableOpacity
          style={headerStyles.sortButton}
          onPress={() => setSortModalVisible(true)}
        >
          <Ionicons name="funnel-outline" size={18} color="#0275d8" />
          <Ionicons
            name={
              sortDirection === "asc"
                ? "arrow-up-outline"
                : "arrow-down-outline"
            }
            size={14}
            color="#0275d8"
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>

        {/* Layout toggle button */}
        <TouchableOpacity
          style={styles.layoutToggleButton}
          onPress={toggleLayoutMode}
        >
          <Ionicons
            name={useGridLayout ? "list" : "grid"}
            size={22}
            color="#0275d8"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const headerStyles = StyleSheet.create({
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
});

export default MatchesHeader;