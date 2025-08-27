/**
 * @file history.tsx
 * @description Screen displaying historical game sessions, player cumulative stats, and overall statistics. Provides a tabbed interface (Games, Players, Stats) without gesture-based swiping for simplicity and accessibility.
 */
import React, { useState, useEffect, useMemo } from "react";
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
import { createHistoryStyles } from "./style/historyStyles";
import { GameSession, PlayerStat } from "../components/history/historyTypes";
import GameHistoryItem from "../components/history/GameHistoryItem";
import GameDetailsModal from "../components/history/GameDetailsModal";
import PlayerStatsList from "../components/history/PlayerStatsList";
import OverallStats from "../components/history/OverallStats";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { calculateLifetimePlayerStats } from "../components/history/historyUtils";
import { useColors } from "./style/theme";

// Define tab names and order
const TABS = ["Games", "Players", "Stats"];

/**
 * HistoryScreen component
 *
 * Renders the history feature area with three tabs:
 *  - Games: List of completed game sessions; selecting one opens a details modal.
 *  - Players: Aggregated lifetime drink statistics per player across all sessions.
 *  - Stats: Overall cumulative stats (e.g., totals / aggregates) derived from history.
 *
 * Internal state:
 *  - selectedGame / isDetailVisible: Manages modal visibility for game details.
 *  - playerStats: Cached lifetime stats derived from store history (recomputed when history changes).
 *  - activeTabIndex: Which of the three tabs is active.
 *  - loading / error: Reserve hooks for potential async history loading (currently not externalized).
 *
 * @returns {JSX.Element} React element for the history screen.
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

  /** Recompute lifetime player statistics when history changes. */
  useEffect(() => {
    if (history.length > 0) {
      const stats = calculateLifetimePlayerStats(history);
      setPlayerStats(stats);
    } else {
      setPlayerStats([]);
    }
  }, [history]);

  /**
   * Switch the active tab.
   * @param {number} tabIndex Index of the tab to activate (0 = Games, 1 = Players, 2 = Stats).
   */
  const switchTab = (tabIndex: number) => {
    setActiveTabIndex(tabIndex);
  };

  /**
   * Open the details modal for a selected game.
   * @param {GameSession} game The game session whose details should be shown.
   */
  const viewGameDetails = (game: GameSession) => {
    if (!game) {
      console.warn("Attempted to open details for null game");
      return;
    }
    setSelectedGame(game);
    setIsDetailVisible(true);
  };

  /** Close the game details modal and clear the current selection. */
  const closeDetails = () => {
    setIsDetailVisible(false);
    setSelectedGame(null); // Also clear the selected game when closing
  };

  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);

  // --- Loading and Error States ---
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <Ionicons
            name="calendar-outline"
            size={60}
            color={colors.neutralGray}
          />
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

      {/* Tab Content Area */}
      <View style={{ flex: 1 }}>
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
                  <Ionicons
                    name="people-outline"
                    size={40}
                    color={colors.neutralGray}
                  />
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
