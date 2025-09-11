/**
 * @file SortHistoryModal.tsx
 * @description Modal component for sorting history items by various criteria such as date, player count, drinks, etc.
 */
import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../app/style/theme";

/** Valid fields that can be used for sorting history items */
export type HistorySortField =
  | "date"
  | "players"
  | "drinks"
  | "goals"
  | "matches";

/** Direction in which items should be sorted */
export type SortDirection = "asc" | "desc";

/**
 * Props for the SortHistoryModal component
 * @property {boolean} visible Whether the modal is currently displayed
 * @property {HistorySortField} sortField Currently active sort field
 * @property {SortDirection} sortDirection Current sort direction (ascending/descending)
 * @property {() => void} onClose Handler for when the modal should close
 * @property {(field: HistorySortField) => void} onSortChange Handler for when user selects a new sort field
 */
interface SortHistoryModalProps {
  visible: boolean;
  sortField: HistorySortField;
  sortDirection: SortDirection;
  onClose: () => void;
  onSortChange: (field: HistorySortField) => void;
}

/**
 * Modal for selecting history sort options
 * @description Presents a modal overlay with sort options for history items.
 * Each option shows a direction indicator when active. Clicking outside or
 * using device back dismisses the modal.
 * @param props Component properties
 * @returns Modal component for sort options
 */
const SortHistoryModal: React.FC<SortHistoryModalProps> = ({
  visible,
  sortField,
  sortDirection,
  onClose,
  onSortChange,
}) => {
  const colors = useColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.backgroundModalOverlay,
          justifyContent: "center",
          alignItems: "center",
        },
        modalContent: {
          width: "80%",
          backgroundColor: colors.surface,
          borderRadius: 10,
          padding: 16,
          elevation: 5,
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 16,
          textAlign: "center",
          color: colors.textPrimary,
        },
        sortOption: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLighter,
        },
        sortOptionText: {
          fontSize: 16,
          color: colors.textSecondary,
        },
      }),
    [colors]
  );

  /**
   * Renders a single sort option row
   * @param field The sort field this option represents
   * @param label User-friendly label for the sort field
   * @returns TouchableOpacity component for the sort option
   */
  const renderSortOption = (field: HistorySortField, label: string) => (
    <TouchableOpacity
      style={styles.sortOption}
      onPress={() => onSortChange(field)}
    >
      <Text style={styles.sortOptionText}>{label}</Text>
      {sortField === field && (
        <Ionicons
          name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
          size={18}
          color={colors.primary}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sort History</Text>
          {renderSortOption("date", "Date")}
          {renderSortOption("players", "Number of Players")}
          {renderSortOption("drinks", "Total Drinks")}
          {renderSortOption("goals", "Total Goals")}
          {renderSortOption("matches", "Number of Matches")}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default SortHistoryModal;
