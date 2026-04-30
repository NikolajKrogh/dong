import React from "react";
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout as isWideViewport } from "../../app/style/responsive";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const isWideLayout = isWideViewport(width);
  return (
    <View
      testID="SetupTabNavigationRoot"
      style={[styles.tabContainer, isWideLayout && styles.tabContainerWide]}
    >
      <TouchableOpacity
        testID="SetupTabNavigationTab"
        style={[
          styles.tab,
          isWideLayout && styles.tabWide,
          activeTab === "players" && styles.activeTab,
        ]}
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
        testID="SetupTabNavigationTab"
        style={[
          styles.tab,
          isWideLayout && styles.tabWide,
          activeTab === "matches" && styles.activeTab,
        ]}
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
        testID="SetupTabNavigationTab"
        style={[
          styles.tab,
          isWideLayout && styles.tabWide,
          activeTab === "assign" && styles.activeTab,
        ]}
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
