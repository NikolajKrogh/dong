import React, { ReactNode, useRef } from "react";
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
import styles, { colors } from "../../app/style/gameProgressStyles";

/**
 * @interface TabNavigationProps
 * @brief Props for the TabNavigation component.
 */
interface TabNavigationProps {
  /** @brief The currently active tab's identifier string. */
  activeTab: string;
  /** @brief Function to set the active tab. */
  setActiveTab: (tab: string) => void;
  /** @brief Array of React nodes, where each node is the content for a tab. */
  children: ReactNode[];
  /** @brief Count of items for the 'matches' tab. */
  matchesCount: number;
  /** @brief Count of items for the 'players' tab. */
  playersCount: number;
  /** @brief Optional RefreshControl element to be applied to the first tab. */
  refreshControl?: React.ReactElement;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;

/**
 * @brief A component that provides tab-based navigation with swipe gestures.
 *
 * This component displays a tab bar and allows users to switch between tab content
 * by tapping on tabs or swiping horizontally. It uses Reanimated for smooth animations.
 *
 * @param {TabNavigationProps} props - The props for the component.
 * @returns {React.FC<TabNavigationProps>} A React functional component.
 */
const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
  children,
  matchesCount,
  playersCount,
  refreshControl,
}) => {
  const tabs = ["matches", "players"];
  const activeIndex = tabs.indexOf(activeTab);
  /** @brief Shared value for the horizontal translation of the tab content. */
  const translateX = useSharedValue(-activeIndex * SCREEN_WIDTH);

  /**
   * @brief Handles changing the active tab.
   * Animates the tab content to the selected tab and updates the active tab state.
   * @param {string} tab - The identifier of the tab to switch to.
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
   * @brief Animated gesture handler for swipe gestures.
   * Manages the horizontal translation of tab content during swipes and
   * determines when to switch tabs based on swipe velocity and distance.
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

  /**
   * @brief Animated style for the tab content container.
   * Applies the horizontal translation based on the `translateX` shared value.
   */
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      flexDirection: "row",
      width: SCREEN_WIDTH * tabs.length,
      flex: 1,
    };
  });

  /**
   * @brief Gets the count for a specific tab.
   * @param {string} tab - The identifier of the tab.
   * @returns {number} The count for the specified tab.
   */
  const getTabCount = (tab: string) => {
    return tab === "matches" ? matchesCount : playersCount;
  };

  /**
   * @brief Gets the icon name for a specific tab.
   * @param {string} tab - The identifier of the tab.
   * @returns {string} The Ionicons name for the tab icon.
   */
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
