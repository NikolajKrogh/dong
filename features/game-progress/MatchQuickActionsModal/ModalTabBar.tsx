import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { createStyles } from "./styles";

interface ModalTabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showStatisticsTab: boolean;
  styles: ReturnType<typeof createStyles>;
}

/** Overview/Statistics tab switcher for the quick-actions modal. */
export const ModalTabBar = ({
  activeTab,
  setActiveTab,
  showStatisticsTab,
  styles,
}: ModalTabBarProps) => {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === "overview" && styles.activeTab]}
        onPress={() => setActiveTab("overview")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "overview" && styles.activeTabText,
          ]}
        >
          Overview
        </Text>
      </TouchableOpacity>

      {showStatisticsTab && (
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "statistics" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("statistics")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "statistics" && styles.activeTabText,
            ]}
          >
            Statistics
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
