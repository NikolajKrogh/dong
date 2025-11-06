/**
 * @file history.tsx
 * @description Screen displaying historical game sessions, player cumulative stats, and overall statistics. Provides a tabbed interface (Games, Players, Stats) without gesture-based swiping for simplicity and accessibility.
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createHistoryStyles } from "./style/historyStyles";
import GameHistoryItem from "../components/history/GameHistoryItem";
import GameDetailsModal from "../components/history/GameDetailsModal";
import PlayerStatsList from "../components/history/PlayerStatsList";
import OverallStats from "../components/history/OverallStats";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "./style/theme";
import SortHistoryModal from "../components/history/SortHistoryModal";
import useHistoryScreenLogic from "../hooks/useHistoryScreenLogic";

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
 *  - sortField / sortDirection: Manages sorting state for the games list.
 *
 * @returns {JSX.Element} React element for the history screen.
 */
const HistoryScreen = () => {
  const navigation = useNavigation();
  const {
    history,
    playerStats,
    sortedHistory,
    selectedGame,
    isDetailVisible,
    activeTabIndex,
    sortField,
    sortDirection,
    sortModalVisible,
    hasGames,
    hasPlayers,
    loading,
    error,
    switchTab,
    viewGameDetails,
    closeDetails,
    handleSortChange,
    openSortModal,
    closeSortModal,
  } = useHistoryScreenLogic();

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
          <View />
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

  // Memoized sorted history
  // --- Main Content Rendering ---
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with integrated sort controls */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game History</Text>
        {activeTabIndex === 0 && (
          <TouchableOpacity
            style={styles.headerSortButton}
            onPress={openSortModal}
          >
            <Ionicons
              name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
              size={20}
              color={colors.primary}
              style={{ marginRight: 4 }}
            />
            <Ionicons name="funnel-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort Modal */}
      <SortHistoryModal
        visible={sortModalVisible}
        sortField={sortField}
        sortDirection={sortDirection}
        onClose={closeSortModal}
        onSortChange={handleSortChange}
      />

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
                data={sortedHistory}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <GameHistoryItem
                    game={item}
                    onDetailsPress={viewGameDetails}
                  />
                )}
                contentContainerStyle={styles.listContent}
                key={`games-list-${sortField}-${sortDirection}`}
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
