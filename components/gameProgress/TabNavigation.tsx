import React, { ReactNode, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { createGameProgressStyles } from "../../app/style/gameProgressStyles";
import { useColors } from "../../app/style/theme";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;

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
  const tabs = ["matches", "players"];
  const activeIndex = tabs.indexOf(activeTab);
  /** Shared value for horizontal translation of the tab content pages. */
  const translateX = useSharedValue(-activeIndex * SCREEN_WIDTH);

  /**
   * Animates to a new tab and updates active tab state.
   * @param {string} tab Target tab identifier.
   */
  const handleTabChange = (tab: string) => {
    const index = tabs.indexOf(tab);
    translateX.value = withSpring(-index * SCREEN_WIDTH, {
      damping: 20,
      stiffness: 90,
    });
    setActiveTab(tab);
  };

  /**
   * Gesture handler controlling horizontal swipes between tabs with velocity & distance thresholds.
   */
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event, ctx: any) => {
      ctx.startX = translateX.value;
      ctx.isVerticalSwipe = false;
    },
    onActive: (event, ctx) => {
      // Prioritize vertical scroll if movement is predominantly vertical
      if (Math.abs(event.translationY) > Math.abs(event.translationX) * 1.5) {
        ctx.isVerticalSwipe = true;
        return;
      }
      // Handle horizontal swipe for tab navigation
      if (!ctx.isVerticalSwipe) {
        const newPosition = ctx.startX + event.translationX;
        // Clamp position to prevent over-swiping
        const minPosition = -(tabs.length - 1) * SCREEN_WIDTH;
        if (newPosition <= 0 && newPosition >= minPosition) {
          translateX.value = newPosition;
        }
      }
    },
    onEnd: (event, ctx) => {
      if (ctx.isVerticalSwipe) return; // Do nothing if it was a vertical scroll

      const currentIndex = Math.round(-translateX.value / SCREEN_WIDTH);
      // Check for swipe to the next tab (left swipe)
      if (
        (event.velocityX < -500 && currentIndex < tabs.length - 1) ||
        (event.translationX < -SWIPE_THRESHOLD &&
          currentIndex < tabs.length - 1)
      ) {
        const newIndex = Math.min(currentIndex + 1, tabs.length - 1);
        translateX.value = withSpring(-newIndex * SCREEN_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveTab)(tabs[newIndex]);
      }
      // Check for swipe to the previous tab (right swipe)
      else if (
        (event.velocityX > 500 && currentIndex > 0) ||
        (event.translationX > SWIPE_THRESHOLD && currentIndex > 0)
      ) {
        const newIndex = Math.max(currentIndex - 1, 0);
        translateX.value = withSpring(-newIndex * SCREEN_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveTab)(tabs[newIndex]);
      }
      // If swipe is not enough to change tab, spring back to the current tab
      else {
        translateX.value = withSpring(-currentIndex * SCREEN_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
      }
    },
  });

  /** Animated style binding translateX to the tab pages container. */
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      flexDirection: "row",
      width: SCREEN_WIDTH * tabs.length,
      flex: 1,
    };
  });

  /** Returns the numeric badge count for a tab. */
  const getTabCount = (tab: string) => {
    return tab === "matches" ? matchesCount : playersCount;
  };

  /** Returns Ionicons name for a given tab. */
  const getTabIcon = (tab: string) => {
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
              <Ionicons
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
        <PanGestureHandler
          onGestureEvent={gestureHandler}
          activeOffsetX={[-10, 10]} // Minimum horizontal distance to activate gesture
          failOffsetY={[-5, 5]} // Maximum vertical distance before gesture fails (allows vertical scroll)
        >
          <Animated.View style={animatedStyle}>
            {tabs.map((tab, index) => {
              const childNode = children[index];
              let contentToRender;

              // Apply RefreshControl only to the first tab if child is a valid element
              if (
                index === 0 &&
                refreshControl &&
                React.isValidElement(childNode)
              ) {
                contentToRender = React.cloneElement(
                  childNode as React.ReactElement<{
                    refreshControl?: React.ReactElement;
                  }>,
                  {
                    refreshControl,
                  }
                );
              }
              // If child is a string, wrap it in a Text component
              else if (typeof childNode === "string") {
                contentToRender = <Text>{childNode}</Text>;
              }
              // Otherwise, render the child as is
              else {
                contentToRender = childNode;
              }

              return (
                <View key={tab} style={styles.tabPage}>
                  {contentToRender}
                </View>
              );
            })}
          </Animated.View>
        </PanGestureHandler>
      </View>
    </View>
  );
};

export default TabNavigation;
