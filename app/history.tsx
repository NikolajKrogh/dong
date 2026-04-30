/**
 * @file history.tsx
 * @description Screen displaying historical game sessions, player cumulative stats, and overall statistics. Provides a tabbed interface (Games, Players, Stats) without gesture-based swiping for simplicity and accessibility.
 */
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useReducer } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../components/AppIcon";
import GameDetailsModal from "../components/history/GameDetailsModal";
import GameHistoryItem from "../components/history/GameHistoryItem";
import HistoryHeader from "../components/history/HistoryHeader";
import { GameSession, PlayerStat } from "../components/history/historyTypes";
import {
  calculateLifetimePlayerStats,
  calculateTotalDrinks,
  calculateTotalGoals,
} from "../components/history/historyUtils";
import OverallStats from "../components/history/OverallStats";
import PlayerStatsList from "../components/history/PlayerStatsList";
import SortHistoryModal, {
  HistorySortField,
  SortDirection,
} from "../components/history/SortHistoryModal";
import { ShellScreen } from "../components/ui";
import { useGameStore } from "../store/store";
import { createHistoryStyles } from "./style/historyStyles";
import { isWideLayout } from "./style/responsive";
import { useColors } from "./style/theme";

// Define tab names and order
const TABS = ["Games", "Players", "Stats"];
const TAB_ICONS = [
  "calendar-outline",
  "people-outline",
  "stats-chart-outline",
] as const;

interface HistoryViewState {
  selectedGame: GameSession | null;
  isDetailVisible: boolean;
  activeTabIndex: number;
  sortField: HistorySortField;
  sortDirection: SortDirection;
  sortModalVisible: boolean;
}

type HistoryViewAction =
  | { type: "openDetails"; game: GameSession }
  | { type: "closeDetails" }
  | { type: "switchTab"; index: number }
  | { type: "toggleSortModal"; visible: boolean }
  | { type: "changeSort"; field: HistorySortField };

const initialHistoryViewState: HistoryViewState = {
  selectedGame: null,
  isDetailVisible: false,
  activeTabIndex: 0,
  sortField: "date",
  sortDirection: "desc",
  sortModalVisible: false,
};

const historyViewReducer = (
  state: HistoryViewState,
  action: HistoryViewAction,
): HistoryViewState => {
  switch (action.type) {
    case "openDetails":
      return {
        ...state,
        selectedGame: action.game,
        isDetailVisible: true,
      };
    case "closeDetails":
      return {
        ...state,
        selectedGame: null,
        isDetailVisible: false,
      };
    case "switchTab":
      return {
        ...state,
        activeTabIndex: action.index,
      };
    case "toggleSortModal":
      return {
        ...state,
        sortModalVisible: action.visible,
      };
    case "changeSort": {
      const isSameField = action.field === state.sortField;
      let nextSortDirection: SortDirection = "desc";

      if (isSameField) {
        nextSortDirection = state.sortDirection === "desc" ? "asc" : "desc";
      }

      return {
        ...state,
        sortField: action.field,
        sortDirection: nextSortDirection,
        sortModalVisible: false,
      };
    }
    default:
      return state;
  }
};

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
  const { width } = useWindowDimensions();
  const wideLayout = isWideLayout(width);
  const { history } = useGameStore();
  const [viewState, dispatch] = useReducer(
    historyViewReducer,
    initialHistoryViewState,
  );
  const error: string | null = null;
  const loading = false;
  const {
    selectedGame,
    isDetailVisible,
    activeTabIndex,
    sortField,
    sortDirection,
    sortModalVisible,
  } = viewState;

  // Sort handler
  const handleSortChange = (field: HistorySortField) => {
    dispatch({ type: "changeSort", field });
  };

  // Remove gesture/animation related state and hooks
  // const translateX = useSharedValue(0);

  /**
   * Switch the active tab.
   * @param {number} tabIndex Index of the tab to activate (0 = Games, 1 = Players, 2 = Stats).
   */
  const switchTab = (tabIndex: number) => {
    dispatch({ type: "switchTab", index: tabIndex });
  };

  /**
   * Open the details modal for a selected game.
   * @param {GameSession} game The game session whose details should be shown.
   */
  const viewGameDetails = useCallback((game: GameSession) => {
    if (!game) {
      console.warn("Attempted to open details for null game");
      return;
    }
    dispatch({ type: "openDetails", game });
  }, []);

  /** Close the game details modal and clear the current selection. */
  const closeDetails = () => {
    dispatch({ type: "closeDetails" });
  };

  const colors = useColors();
  const styles = useMemo(
    () =>
      createHistoryStyles(colors, {
        screenWidth: width,
        isWideLayout: wideLayout,
      }),
    [colors, wideLayout, width],
  );

  const playerStats = useMemo<PlayerStat[]>(() => {
    return history.length > 0 ? calculateLifetimePlayerStats(history) : [];
  }, [history]);

  // Memoized sorted history
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      let comparison: number;

      switch (sortField) {
        case "date":
          comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          break;
        case "players":
          comparison = b.players.length - a.players.length;
          break;
        case "drinks":
          comparison =
            calculateTotalDrinks(b.players) - calculateTotalDrinks(a.players);
          break;
        case "goals":
          comparison =
            calculateTotalGoals(b.matches) - calculateTotalGoals(a.matches);
          break;
        case "matches":
          comparison = b.matches.length - a.matches.length;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "desc" ? comparison : -comparison;
    });
  }, [history, sortDirection, sortField]);

  const renderGameItem = useCallback(
    (listItem: { item: GameSession }) => (
      <GameHistoryItem game={listItem.item} onDetailsPress={viewGameDetails} />
    ),
    [viewGameDetails],
  );

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
        <ShellScreen
          padded={false}
          centerContent={wideLayout}
          contentMaxWidth={wideLayout ? 1120 : undefined}
        >
          <HistoryHeader
            onBack={() => navigation.goBack()}
            showSortButton={false}
            sortDirection="desc"
            onOpenSortModal={() => undefined}
          />
          <View style={styles.emptyStateContainer}>
            <AppIcon
              name="calendar-outline"
              size={60}
              color={colors.neutralGray}
            />
            <Text style={styles.emptyStateText}>
              No game history yet. Play some games to see your stats and history
              here!
            </Text>
          </View>
        </ShellScreen>
      </SafeAreaView>
    );
  }

  // --- Main Content Rendering ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={wideLayout}
        contentMaxWidth={wideLayout ? 1120 : undefined}
      >
        <HistoryHeader
          onBack={() => navigation.goBack()}
          showSortButton={activeTabIndex === 0}
          sortDirection={sortDirection}
          onOpenSortModal={() =>
            dispatch({ type: "toggleSortModal", visible: true })
          }
        />

        {/* Sort Modal */}
        <SortHistoryModal
          visible={sortModalVisible}
          sortField={sortField}
          sortDirection={sortDirection}
          onClose={() => dispatch({ type: "toggleSortModal", visible: false })}
          onSortChange={handleSortChange}
        />

        {/* Tab Navigation Buttons */}
        <View
          style={[styles.tabsContainer, wideLayout && styles.tabsContainerWide]}
        >
          {TABS.map((tabName, index) => (
            <TouchableOpacity
              key={tabName}
              testID={`HistoryTab-${tabName}`}
              style={[styles.tab, activeTabIndex === index && styles.activeTab]}
              onPress={() => switchTab(index)}
            >
              <View style={styles.iconRow}>
                <AppIcon
                  name={TAB_ICONS[index]}
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
                  renderItem={renderGameItem}
                  contentContainerStyle={[
                    styles.listContent,
                    wideLayout && styles.listContentWide,
                  ]}
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
                    <AppIcon
                      name="people-outline"
                      size={40}
                      color={colors.neutralGray}
                    />
                    <Text style={styles.emptyStateText}>
                      No player data yet.
                    </Text>
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
      </ShellScreen>

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
