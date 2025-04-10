import React, { ReactNode, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
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
import styles from "../../app/style/gameProgressStyles";

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: ReactNode[];
  matchesCount: number;
  playersCount: number;
  refreshControl?: React.ReactElement; // Add this prop
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;

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
  const translateX = useSharedValue(-activeIndex * SCREEN_WIDTH);

  // Create refs for the scroll views to use with simultaneousHandlers
  const scrollViewRefs = useRef(tabs.map(() => React.createRef()));

  const handleTabChange = (tab: string) => {
    const index = tabs.indexOf(tab);
    translateX.value = withSpring(-index * SCREEN_WIDTH, {
      damping: 20,
      stiffness: 90,
    });
    setActiveTab(tab);
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event, ctx: any) => {
      ctx.startX = translateX.value;
      ctx.isVerticalSwipe = false;
    },
    onActive: (event, ctx) => {
      // If the vertical movement is greater than horizontal, it's likely a scroll
      if (Math.abs(event.translationY) > Math.abs(event.translationX) * 1.5) {
        ctx.isVerticalSwipe = true;
        return;
      }

      // Only handle horizontal swipes, not vertical scrolling
      if (!ctx.isVerticalSwipe) {
        const newPosition = ctx.startX + event.translationX;
        const minPosition = -(tabs.length - 1) * SCREEN_WIDTH;

        if (newPosition <= 0 && newPosition >= minPosition) {
          translateX.value = newPosition;
        }
      }
    },
    onEnd: (event, ctx) => {
      // Don't handle tab switching if this was a vertical swipe
      if (ctx.isVerticalSwipe) return;

      const currentIndex = Math.round(-translateX.value / SCREEN_WIDTH);

      // Determine if we should change tabs based on swipe direction and velocity
      if (
        (event.velocityX < -500 && currentIndex < tabs.length - 1) ||
        (event.translationX < -SWIPE_THRESHOLD &&
          currentIndex < tabs.length - 1)
      ) {
        // Swipe left to next tab
        const newIndex = Math.min(currentIndex + 1, tabs.length - 1);
        translateX.value = withSpring(-newIndex * SCREEN_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveTab)(tabs[newIndex]);
      } else if (
        (event.velocityX > 500 && currentIndex > 0) ||
        (event.translationX > SWIPE_THRESHOLD && currentIndex > 0)
      ) {
        // Swipe right to previous tab
        const newIndex = Math.max(currentIndex - 1, 0);
        translateX.value = withSpring(-newIndex * SCREEN_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveTab)(tabs[newIndex]);
      } else {
        // Spring back to current tab if swipe wasn't strong enough
        translateX.value = withSpring(-currentIndex * SCREEN_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      flexDirection: "row",
      width: SCREEN_WIDTH * tabs.length,
      flex: 1,
    };
  });

  // Get the tab count based on tab name
  const getTabCount = (tab: string) => {
    return tab === "matches" ? matchesCount : playersCount;
  };

  // Get the icon name based on tab name
  const getTabIcon = (tab: string) => {
    return tab === "matches" ? "football" : "people";
  };

  return (
    <View style={localStyles.container}>
      {/* Enhanced Tab Bar */}
      <View style={localStyles.tabBarContainer}>
        <View style={localStyles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                localStyles.tabButton,
                activeTab === tab && localStyles.activeTabButton,
              ]}
              onPress={() => handleTabChange(tab)}
            >
              <Ionicons
                name={getTabIcon(tab)}
                size={20}
                color={activeTab === tab ? "#0275d8" : "#777"}
              />
              <Text
                style={[
                  localStyles.tabButtonText,
                  activeTab === tab && localStyles.activeTabButtonText,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View style={localStyles.tabBadge}>
                <Text style={localStyles.tabBadgeText}>{getTabCount(tab)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={localStyles.contentContainer}>
        <PanGestureHandler
          onGestureEvent={gestureHandler}
          activeOffsetX={[-10, 10]} // Only activate after moving 10px horizontally
          failOffsetY={[-5, 5]} // Fail if moving 5px vertically
        >
          <Animated.View style={animatedStyle}>
            {tabs.map((tab, index) => (
              <View key={tab} style={localStyles.tabPage}>
                {/* Apply RefreshControl only to the active tab */}
                {index === 0 && refreshControl
                  ? React.cloneElement(children[index] as React.ReactElement, {
                      refreshControl,
                    })
                  : children[index]}
              </View>
            ))}
          </Animated.View>
        </PanGestureHandler>
      </View>
    </View>
  );
};

// Local styles for the enhanced UI
const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  contentContainer: {
    flex: 1,
    overflow: "hidden",
  },
  tabPage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  tabBarContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: "hidden",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  activeTabButton: {
    backgroundColor: "#e3f2fd",
  },
  tabButtonText: {
    fontSize: 15,
    color: "#777",
    marginLeft: 8,
  },
  activeTabButtonText: {
    color: "#0275d8",
    fontWeight: "500",
  },
  tabBadge: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    fontSize: 12,
    color: "#666",
  },
});

export default TabNavigation;
