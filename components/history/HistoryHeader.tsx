/**
 * @file HistoryHeader.tsx
 * @description Header component for the history view that contains sorting controls.
 */
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../app/style/theme";
import { HistorySortField, SortDirection } from "./SortHistoryModal";

/**
 * Props for the HistoryHeader component
 * @property {HistorySortField} sortField Currently active sort field
 * @property {SortDirection} sortDirection Current sort direction (ascending/descending)
 * @property {(visible: boolean) => void} setSortModalVisible Handler to show/hide the sort modal
 */
interface HistoryHeaderProps {
  sortField: HistorySortField;
  sortDirection: SortDirection;
  setSortModalVisible: (visible: boolean) => void;
}

/**
 * Header component with sort controls
 * @description Displays a bar with sorting controls that opens a sort modal when clicked.
 * Shows the current sort direction with an up/down arrow.
 * @param props Component properties
 * @returns Header component with sort controls
 */
const HistoryHeader: React.FC<HistoryHeaderProps> = ({
  sortField,
  sortDirection,
  setSortModalVisible,
}) => {
  const colors = useColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLighter,
        },
        sortButton: {
          flexDirection: "row",
          alignItems: "center",
          padding: 8,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => setSortModalVisible(true)}
      >
        <Ionicons
          name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
          size={20}
          color={colors.primary}
          style={{ marginRight: 4 }}
        />
        <Ionicons name="funnel-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default HistoryHeader;
