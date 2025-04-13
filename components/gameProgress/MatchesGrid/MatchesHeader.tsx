import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchesHeaderProps } from "./types";
import styles from "../../../app/style/gameProgressStyles";

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
