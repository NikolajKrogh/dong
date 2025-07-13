import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SortModalProps } from "./types";
import { colors } from "../../../app/style/palette";

/**
 * @brief A modal component for selecting match sorting options.
 * - Allows users to sort matches by Home Team, Away Team, or Player Name.
 * - Displays the current sort field and direction.
 * @param {SortModalProps} props - The properties passed to the component.
 * @param {boolean} props.visible - Controls the visibility of the modal.
 * @param {string} props.sortField - The currently active sort field ('homeTeam', 'awayTeam', 'playerName').
 * @param {'asc' | 'desc'} props.sortDirection - The current sort direction.
 * @param {() => void} props.onClose - Function to call when the modal should be closed (e.g., overlay press).
 * @param {(field: 'homeTeam' | 'awayTeam' | 'playerName') => void} props.onSortChange - Function to call when a sort option is selected.
 * @returns {React.ReactElement} The rendered sort modal component.
 */
const SortModal: React.FC<SortModalProps> = ({
  visible,
  sortField,
  sortDirection,
  onClose,
  onSortChange,
}) => {
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
          <Text style={styles.modalTitle}>Sort Matches</Text>

          {/* Sort by Home Team option */}
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => onSortChange("homeTeam")}
          >
            <Text style={styles.sortOptionText}>Home Team</Text>
            {sortField === "homeTeam" && (
              <Ionicons
                name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
                size={18}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>

          {/* Sort by Away Team option */}
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => onSortChange("awayTeam")}
          >
            <Text style={styles.sortOptionText}>Away Team</Text>
            {sortField === "awayTeam" && (
              <Ionicons
                name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
                size={18}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>

          {/* Sort by Player Name option */}
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => onSortChange("playerName")}
          >
            <Text style={styles.sortOptionText}>Player Name</Text>
            {sortField === "playerName" && (
              <Ionicons
                name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
                size={18}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
});

export default SortModal;
