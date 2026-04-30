/**
 * @file HistoryHeader.tsx
 * @description Header component for the history view that contains sorting controls.
 */
import React from "react";
import { View, TouchableOpacity, Text, useWindowDimensions } from "react-native";
import AppIcon from "../AppIcon";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import { SortDirection } from "./SortHistoryModal";

/**
 * Props for the HistoryHeader component
 * @property {() => void} onBack Handler for the back action
 * @property {boolean} showSortButton Whether to show the sort action
 * @property {SortDirection} sortDirection Current sort direction (ascending/descending)
 * @property {() => void} onOpenSortModal Handler to show the sort modal
 */
interface HistoryHeaderProps {
  title?: string;
  onBack: () => void;
  showSortButton: boolean;
  sortDirection: SortDirection;
  onOpenSortModal: () => void;
}

/**
 * Header component with sort controls
 * @description Displays a bar with sorting controls that opens a sort modal when clicked.
 * Shows the current sort direction with an up/down arrow.
 * @param props Component properties
 * @returns Header component with sort controls
 */
const HistoryHeader: React.FC<HistoryHeaderProps> = ({
  title = "Game History",
  onBack,
  showSortButton,
  sortDirection,
  onOpenSortModal,
}) => {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1024;
  const styles = React.useMemo(
    () => createHistoryStyles(colors, { screenWidth: width, isWideLayout }),
    [colors, isWideLayout, width],
  );

  return (
    <View
      testID="HistoryHeaderContainer"
      style={[styles.pageHeader, isWideLayout && styles.pageHeaderWide]}
    >
      <TouchableOpacity
        testID="HistoryHeaderBackButton"
        style={styles.headerBackButton}
        onPress={onBack}
      >
        <AppIcon name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{title}</Text>

      {showSortButton ? (
        <TouchableOpacity
          testID="HistoryHeaderSortButton"
          style={styles.headerSortButton}
          onPress={onOpenSortModal}
        >
          <AppIcon
            name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
            size={20}
            color={colors.primary}
            style={{ marginRight: 4 }}
          />
          <AppIcon name="funnel-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <View testID="HistoryHeaderPlaceholder" style={styles.rightPlaceholder} />
      )}
    </View>
  );
};

export default HistoryHeader;
