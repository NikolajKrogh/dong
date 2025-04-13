import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useGameStore } from "../store/store";
import { styles, colors } from "./style/historyStyles";
import { GameSession, PlayerStat } from "../components/history/historyTypes";
import GameHistoryItem from "../components/history/GameHistoryItem";
import GameDetailsModal from "../components/history/GameDetailsModal";
import PlayerStatsList from "../components/history/PlayerStatsList";
import OverallStats from "../components/history/OverallStats";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { calculateLifetimePlayerStats } from "../components/history/historyUtils";

// Define tab names and order
const TABS = ["Games", "Players", "Stats"];

/**
 * @component HistoryScreen
 * @brief A screen component that displays game history with multiple tabs for different views.
 * (Gesture handling removed)
 */
const HistoryScreen = () => {
  const navigation = useNavigation();
  const { history } = useGameStore();
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Remove gesture/animation related state and hooks
  // const translateX = useSharedValue(0);

  /**
   * @brief Effect for calculating player lifetime statistics.
   */
  useEffect(() => {
    if (history.length > 0) {
      const stats = calculateLifetimePlayerStats(history);
      setPlayerStats(stats);
    } else {
      setPlayerStats([]);
    }
  }, [history]);

  /**
   * @brief Switches between tabs via button press.
   * @param tabIndex The index of the tab to switch to.
   */
  const switchTab = (tabIndex: number) => {
    setActiveTabIndex(tabIndex);
  };

  /**
   * @brief Opens the details modal for a selected game.
   */
  const viewGameDetails = (game: GameSession) => {
    if (!game) {
      console.warn("Attempted to open details for null game");
      return;
    }
    setSelectedGame(game);
    setIsDetailVisible(true);
  };

  /**
   * @brief Closes the details modal.
   */
  const closeDetails = () => {
    setIsDetailVisible(false);
    setSelectedGame(null); // Also clear the selected game when closing
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
                color={
                  activeTabIndex === index ? colors.primary : colors.textMuted
                }
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

      {/* Tab Content Area - WITHOUT Swipe */}
      <View style={{ flex: 1 }}>
        {/* Remove PanGestureHandler */}
        {/* Remove Animated.View, use regular View */}
        {/* Use conditional rendering based on activeTabIndex */}
        <View style={{ flex: 1 }}>
          {activeTabIndex === 0 && (
            <View style={styles.tabContent}>
              <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <GameHistoryItem
                    game={item}
                    onDetailsPress={viewGameDetails}
                  />
                )}
                contentContainerStyle={styles.listContent}
                // Add a key to potentially help with re-rendering if needed
                key="games-list"
              />
            </View>
          )}

          {activeTabIndex === 1 && (
            <View style={styles.tabContent}>
              {hasPlayers ? (
                <ScrollView key="players-scroll">
                  <PlayerStatsList playerStats={playerStats} />
                </ScrollView>
              ) : (
                <View style={styles.emptyTabContent}>
                  <Ionicons name="people-outline" size={40} color="#ccc" />
                  <Text style={styles.emptyStateText}>No player data yet.</Text>
                </View>
              )}
            </View>
          )}

          {activeTabIndex === 2 && (
            <View style={styles.tabContent}>
              <ScrollView key="stats-scroll">
                <OverallStats history={history} />
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Game Details Modal - Render conditionally */}
      {isDetailVisible && selectedGame && (
        <GameDetailsModal
          game={selectedGame}
          visible={isDetailVisible}
          onClose={closeDetails}
        />
      )}
    </SafeAreaView>
  );
};

export default HistoryScreen;
