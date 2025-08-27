/**
 * @file SortModal.tsx
 * @description Modal component allowing users to choose a field and direction for sorting match/player listings. Displays options and indicates current selection with an arrow icon.
 */
import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SortModalProps } from "./types";
import { useColors } from "../../../app/style/theme";

/**
 * SortModal component
 * @description Presents a lightweight overlay with selectable sort fields. Selecting an option triggers `onSortChange` with the field (direction handled by parent logic). Clicking outside or using the device back closes the modal via `onClose`.
 * @param props.visible Whether the modal is shown.
 * @param props.sortField Currently active sort field.
 * @param props.sortDirection Direction (ascending/descending) used to pick icon.
 * @param props.onClose Callback to dismiss the modal.
 * @param props.onSortChange Callback invoked with chosen field key.
 */
const SortModal: React.FC<SortModalProps> = ({
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

export default SortModal;
