import React, { ReactNode, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";

import AppIcon, { AppIconName } from "../AppIcon";
import { createGameProgressStyles } from "../../app/style/gameProgressStyles";
import { useColors } from "../../app/style/theme";
import { PlatformSwipeTabs } from "../../platform";

/**
 * Props for the TabNavigation component.
 * @interface
 */
interface TabNavigationProps {
  /** The currently active tab's identifier string. */
  activeTab: string;
  /** Setter invoked to change the active tab. */
  setActiveTab: (tab: string) => void;
  /** Array of React nodes, each representing a tab's content (order matters). */
  children: ReactNode[];
  /** Count of items for the 'matches' tab (displayed as a badge). */
  matchesCount: number;
  /** Count of items for the 'players' tab (displayed as a badge). */
  playersCount: number;
  /** Optional RefreshControl applied only to the first (matches) tab. */
  refreshControl?: React.ReactElement;
}

/**
 * Tab navigation with swipe gestures and animated transitions.
 * @component
 * @param {TabNavigationProps} props Component props.
 * @returns {React.ReactElement} Rendered tab navigation UI.
 * @description Renders a tab bar (matches / players) with counts and icons. Users can switch tabs by tapping or via horizontal swipe gestures handled with Reanimated + Gesture Handler. Horizontal gestures are suppressed when a predominantly vertical scroll is detected to avoid interference with list scrolling. Applies an optional RefreshControl only to the first tab's content.
 */
const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
  children,
  matchesCount,
  playersCount,
  refreshControl,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const tabs = ["matches", "players"];
  const activeIndex = Math.max(tabs.indexOf(activeTab), 0);

  /**
   * Animates to a new tab and updates active tab state.
   * @param {string} tab Target tab identifier.
   */
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  /** Returns the numeric badge count for a tab. */
  const getTabCount = (tab: string) => {
    return tab === "matches" ? matchesCount : playersCount;
  };

  /** Returns Ionicons name for a given tab. */
  const getTabIcon = (tab: string): AppIconName => {
    return tab === "matches" ? "football" : "people";
  };

  return (
    <View style={styles.tabNavContainer}>
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && styles.activeTabButton,
              ]}
              onPress={() => handleTabChange(tab)}
            >
              <AppIcon
                name={getTabIcon(tab)}
                size={20}
                color={activeTab === tab ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === tab && styles.activeTabButtonText,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{getTabCount(tab)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tabNavContentContainer}>
        <PlatformSwipeTabs
          activeIndex={activeIndex}
          onIndexChange={(index) => setActiveTab(tabs[index] ?? tabs[0])}
          pageWidth={width}
          pageStyle={styles.tabPage}
          containerStyle={{ flex: 1 }}
          refreshControl={refreshControl}
        >
          {tabs.map((tab, index) => {
            const childNode = children[index];

            if (typeof childNode === "string") {
              return <Text key={tab}>{childNode}</Text>;
            }

            return <React.Fragment key={tab}>{childNode}</React.Fragment>;
          })}
        </PlatformSwipeTabs>
      </View>
    </View>
  );
};

export default TabNavigation;
