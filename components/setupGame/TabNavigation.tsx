import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../app/style/setupGameStyles";

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === "players" && styles.activeTab]}
        onPress={() => setActiveTab("players")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "players" && styles.activeTabText,
          ]}
        >
          Players
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === "matches" && styles.activeTab]}
        onPress={() => setActiveTab("matches")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "matches" && styles.activeTabText,
          ]}
        >
          Matches
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === "assign" && styles.activeTab]}
        onPress={() => setActiveTab("assign")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "assign" && styles.activeTabText,
          ]}
        >
          Assign
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default TabNavigation;
