import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchesHeaderProps } from "./types";
import { createGameProgressStyles } from "../../../app/style/gameProgressStyles";
import { useColors } from "../../../app/style/theme";

/**
 * Header for the matches grid/list.
 * @description Renders the section title and action buttons: a sort toggle (opens modal)
 * and a layout toggle (grid/list). Pure presentational component with no internal state.
 * @param {MatchesHeaderProps} props Component props.
 * @param {string} props.sortField Currently selected sort field.
 * @param {'asc'|'desc'} props.sortDirection Current sort direction.
 * @param {boolean} props.useGridLayout Whether grid layout is active.
 * @param {(visible: boolean) => void} props.setSortModalVisible Setter to show/hide the sort modal.
 * @param {() => void} props.toggleLayoutMode Handler to switch between grid and list layouts.
 * @returns {React.ReactElement} Header element.
 */
const MatchesHeader: React.FC<MatchesHeaderProps> = ({
  sortField,
  sortDirection,
  useGridLayout,
  setSortModalVisible,
  toggleLayoutMode,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Matches</Text>

      <View style={styles.headerButtons}>
        {/* Sort button */}
        <TouchableOpacity
          style={headerStyles.sortButton}
          onPress={() => setSortModalVisible(true)}
        >
          <Ionicons name="funnel-outline" size={18} color={colors.primary} />
          <Ionicons
            name={
              sortDirection === "asc"
                ? "arrow-up-outline"
                : "arrow-down-outline"
            }
            size={14}
            color={colors.primary}
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
            color={colors.primary}
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
