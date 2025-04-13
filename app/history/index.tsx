import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
// Import from reanimated and gesture handler
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { useGameStore } from "../store";
import { styles, colors } from "./historyStyles";
import { GameSession, PlayerStat } from "./historyTypes";
import GameHistoryItem from "./GameHistoryItem";
import GameDetailsModal from "./GameDetailsModal";
import PlayerStatsList from "./PlayerStatsList";
import OverallStats from "./OverallStats";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { calculateLifetimePlayerStats } from "./historyUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2; // Threshold to trigger tab change

// Define tab names and order
const TABS = ["Games", "Players", "Stats"];

/**
 * @component HistoryScreen
 * @brief A screen component that displays game history with multiple tabs for different views.
 *
 * This screen shows three main views:
 * 1. Games - List of past game sessions
 * 2. Players - Statistics for each player across all games
 * 3. Stats - Overall aggregated statistics
 *
 * The screen handles tab navigation (buttons and swipe), empty states, and modal detail views.
 *
 * @returns {React.ReactElement} The rendered HistoryScreen component.
 */
const HistoryScreen = () => {
  const navigation = useNavigation();
  const { history } = useGameStore();
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0); // Use index now
  // const scrollViewRef = useRef<ScrollView>(null); // Not needed for swipe animation
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * @brief Reanimated shared value for horizontal translation.
   */
  const translateX = useSharedValue(0);

  /**
   * @brief Effect for calculating player lifetime statistics.
   * Processes all game history to aggregate player performance data.
   */
  useEffect(() => {
    if (history.length > 0) {
      const stats = calculateLifetimePlayerStats(history);
      setPlayerStats(stats);
    } else {
      setPlayerStats([]); // Clear stats if history is empty
    }
  }, [history]);

  /**
   * @brief Updates the active tab index state.
   * Wrapped with runOnJS to be called from gesture handler.
   * @param index The new active tab index.
   */
  const updateActiveTab = (index: number) => {
    setActiveTabIndex(index);
  };

  /**
   * @brief Switches between tabs via button press with animated transition.
   * @param tabIndex The index of the tab to switch to.
   */
  const switchTab = (tabIndex: number) => {
    translateX.value = withSpring(-tabIndex * SCREEN_WIDTH, {
      damping: 20,
      stiffness: 90,
    });
    setActiveTabIndex(tabIndex);
  };

  /**
   * @brief Gesture handler for swipe navigation.
   */
  type AnimatedGHContext = {
    startX: number;
  };
  const gestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    AnimatedGHContext
  >({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      // Allow swipe only horizontally
      if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
         const newX = ctx.startX + event.translationX;
         // Clamp translation within bounds
         translateX.value = Math.max(
           -(TABS.length - 1) * SCREEN_WIDTH,
           Math.min(0, newX)
         );
      }
    },
    onEnd: (event) => {
      const currentOffset = translateX.value;
      const currentIndex = Math.round(-currentOffset / SCREEN_WIDTH);
      let targetIndex = currentIndex;

      // Determine target index based on swipe velocity and threshold
      if (event.translationX < -SWIPE_THRESHOLD || event.velocityX < -500) {
        targetIndex = Math.min(currentIndex + 1, TABS.length - 1);
      } else if (event.translationX > SWIPE_THRESHOLD || event.velocityX > 500) {
        targetIndex = Math.max(currentIndex - 1, 0);
      }

      // Animate to the target index
      const targetOffset = -targetIndex * SCREEN_WIDTH;
      translateX.value = withSpring(targetOffset, {
        damping: 20,
        stiffness: 90,
      });

      // Update the active tab state if the index changed
      if (targetIndex !== currentIndex) {
        runOnJS(updateActiveTab)(targetIndex);
      }
    },
  });

  /**
   * @brief Animated style for the tab content wrapper.
   */
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      flexDirection: "row", // Keep content side-by-side
      width: SCREEN_WIDTH * TABS.length, // Set width for all tabs
      flex: 1,
    };
  });


  /**
   * @brief Opens the details modal for a selected game.
   * @param game The game session to display details for.
   */
  const viewGameDetails = (game: GameSession) => {
    setSelectedGame(game);
    setIsDetailVisible(true);
  };

  /**
   * @brief Closes the details modal.
   */
  const closeDetails = () => {
    setIsDetailVisible(false);
  };

  /**
   * @brief Navigates to the game setup screen.
   */
  const goToSetup = () => {
    // @ts-ignore
    navigation.navigate("SetupGame");
  };

  // --- Loading and Error States ---
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0275d8" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyStateText}>{error}</Text>
      </View>
    );
  }

  // Determine if we have data to show
  const hasGames = history.length > 0;
  const hasPlayers = playerStats.length > 0;

  // --- Empty State Rendering ---
  if (!hasGames && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pageHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Game History</Text>
          <View style={styles.rightPlaceholder} />
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="calendar-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>
            No game history yet. Play some games to see your stats and history
            here!
          </Text>
          <TouchableOpacity style={styles.startGameButton} onPress={goToSetup}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.startGameButtonText}>Start a New Game</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Main Content Rendering ---
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game History</Text>
        <View style={styles.rightPlaceholder} />
      </View>

      {/* Tab Navigation Buttons */}
      <View style={styles.tabsContainer}>
        {TABS.map((tabName, index) => (
          <TouchableOpacity
            key={tabName}
            style={[styles.tab, activeTabIndex === index && styles.activeTab]}
            onPress={() => switchTab(index)}
          >
            <View style={styles.iconRow}>
              <Ionicons
                name={
                  index === 0
                    ? "calendar-outline"
                    : index === 1
                    ? "people-outline"
                    : "stats-chart-outline"
                }
                size={18}
                color={activeTabIndex === index ? "#0275d8" : "#666"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTabIndex === index && styles.activeTabText,
                ]}
              >
                {tabName}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content Area with Swipe */}
      <View style={{ flex: 1, overflow: 'hidden' }}> {/* Added container to prevent content overflow */}
        <PanGestureHandler
          onGestureEvent={gestureHandler}
          activeOffsetX={[-10, 10]} // Activate after 10px horizontal move
          failOffsetY={[-5, 5]}     // Fail if vertical move is > 5px
        >
          <Animated.View style={animatedStyle}>
            {/* Games Tab */}
            <View style={styles.tabContent}>
              <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <GameHistoryItem game={item} onDetailsPress={viewGameDetails} />
                )}
                contentContainerStyle={styles.listContent}
              />
            </View>

            {/* Players Tab */}
            <View style={styles.tabContent}>
              {hasPlayers ? (
                 <ScrollView> {/* Wrap PlayerStatsList in ScrollView if it might exceed screen height */}
                    <PlayerStatsList playerStats={playerStats} />
                 </ScrollView>
              ) : (
                <View style={styles.emptyTabContent}>
                  <Ionicons name="people-outline" size={40} color="#ccc" />
                  <Text style={styles.emptyStateText}>No player data yet.</Text>
                </View>
              )}
            </View>

            {/* Stats Tab */}
            <View style={styles.tabContent}>
               <ScrollView> {/* Wrap OverallStats in ScrollView */}
                 <OverallStats history={history} />
               </ScrollView>
            </View>
          </Animated.View>
        </PanGestureHandler>
      </View>

      {/* Game Details Modal */}
      <GameDetailsModal
        game={selectedGame}
        visible={isDetailVisible}
        onClose={closeDetails}
      />
    </SafeAreaView>
  );
};

export default HistoryScreen;