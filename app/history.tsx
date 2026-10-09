/**
 * @description Screen displaying historical game sessions, player cumulative stats, and overall statistics. Provides a tabbed interface (Games, Players, Stats) without gesture-based swiping for simplicity and accessibility.
 */
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../components/AppIcon";
import GameDetailsModal from "../components/history/GameDetailsModal";
import GameHistoryItem from "../components/history/GameHistoryItem";
import { buildHistoryRows, type HistoryGameRow } from "../components/history/historyLayout";
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
import { ShellActionButton, ShellScreen } from "../components/ui";
import { useHistory } from "../features/history";
import { createHistoryStyles } from "../styles/historyStyles";
import { isWideLayout } from "../styles/responsive";
import { useColors } from "../styles/theme";

const TABS = ["Games", "Players", "Stats"];
const TAB_ICONS = ["calendar-outline", "people-outline", "stats-chart-outline"] as const;
const centeredContentProps = { alignSelf: "center" } as const;
const historyLayoutStyles = {
  cloudStatus: { padding: 16 },
  viewport: { flex: 1, minHeight: 0 },
  tabPanels: { flex: 1 },
  historyRow: { marginBottom: 16 },
  historyRowHeading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  historyRowCards: {
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
  },
  historyRowCard: { flex: 1, minWidth: 0 },
  historyRowFiller: { flex: 1 },
} as const;

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
      return { ...state, selectedGame: action.game, isDetailVisible: true };
    case "closeDetails":
      return { ...state, selectedGame: null, isDetailVisible: false };
    case "switchTab":
      return { ...state, activeTabIndex: action.index };
    case "toggleSortModal":
      return { ...state, sortModalVisible: action.visible };
    case "changeSort": {
      const nextSortDirection: SortDirection = action.field === state.sortField
        ? state.sortDirection === "desc" ? "asc" : "desc"
        : "desc";
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

type HistoryScreenState = ReturnType<typeof useHistory>;
type HistoryStyles = ReturnType<typeof createHistoryStyles>;
type HistoryColors = ReturnType<typeof useColors>;

interface HistoryContentData extends Pick<HistoryScreenState, "history" | "loading" | "error" | "refresh" | "accountId"> {
  playerStats: PlayerStat[];
  gameRows: HistoryGameRow[];
}

interface HistoryLayout {
  width: number;
  availableWidth: number;
  wideLayout: boolean;
  shellWideLayout: boolean;
  columns: number;
  styles: HistoryStyles;
  colors: HistoryColors;
}

interface HistoryActions {
  onBack: () => void;
  onOpenSort: () => void;
  onCloseSort: () => void;
  onSortChange: (field: HistorySortField) => void;
  onSwitchTab: (index: number) => void;
  onOpenGame: (game: GameSession) => void;
  onCloseDetails: () => void;
  onRetry: () => void;
  onMeasureViewport: (event: { nativeEvent: { layout: { width: number } } }) => void;
}

const HistoryScreen = () => {
  const historyState = useHistory();
  const { refresh } = historyState;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <HistoryContent key={historyState.accountId ?? "local"} {...historyState} />;
};

const HistoryContent = (historyState: HistoryScreenState) => {
  const router = useRouter();
  const { history, loading, error, refresh, accountId } = historyState;
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const availableWidth = Math.min(measuredWidth ?? width, width, 1120);
  const wideLayout = isWideLayout(availableWidth);
  const shellWideLayout = isWideLayout(width);
  const columns = wideLayout && fontScale < 1.5 ? 2 : 1;
  const [viewState, dispatch] = useReducer(historyViewReducer, initialHistoryViewState);
  const selectedGame = viewState.selectedGame;
  const { sortField, sortDirection } = viewState;
  const selectedResult = history.find((game) => game.id === selectedGame?.id);
  const colors = useColors();
  const styles = useMemo(
    () => createHistoryStyles(colors, { screenWidth: width, isWideLayout: wideLayout }),
    [colors, wideLayout, width],
  );
  const playerStats = useMemo<PlayerStat[]>(
    () => history.length > 0 ? calculateLifetimePlayerStats(history) : [],
    [history],
  );
  const sortedHistory = useMemo(
    () => sortHistory(history, sortField, sortDirection),
    [history, sortDirection, sortField],
  );
  const gameRows = useMemo(
    () => buildHistoryRows(sortedHistory, columns, sortField === "date"),
    [sortedHistory, columns, sortField],
  );

  const onSortChange = useCallback((field: HistorySortField) => {
    dispatch({ type: "changeSort", field });
  }, []);
  const onSwitchTab = useCallback((index: number) => {
    dispatch({ type: "switchTab", index });
  }, []);
  const onOpenGame = useCallback((game: GameSession) => {
    if (!game) {
      console.warn("Attempted to open details for null game");
      return;
    }
    dispatch({ type: "openDetails", game });
  }, []);
  const onCloseDetails = useCallback(() => {
    dispatch({ type: "closeDetails" });
  }, []);
  const onBack = useCallback(() => router.back(), [router]);
  const onOpenSort = useCallback(() => {
    dispatch({ type: "toggleSortModal", visible: true });
  }, []);
  const onCloseSort = useCallback(() => {
    dispatch({ type: "toggleSortModal", visible: false });
  }, []);
  const onRetry = useCallback(() => { void refresh(); }, [refresh]);
  const onMeasureViewport = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setMeasuredWidth(nextWidth);
  }, []);

  const data = useMemo<HistoryContentData>(
    () => ({ history, loading, error, refresh, accountId, playerStats, gameRows }),
    [history, loading, error, refresh, accountId, playerStats, gameRows],
  );
  const layout = useMemo<HistoryLayout>(
    () => ({ width, availableWidth, wideLayout, shellWideLayout, columns, styles, colors }),
    [width, availableWidth, wideLayout, shellWideLayout, columns, styles, colors],
  );
  const actions = useMemo<HistoryActions>(
    () => ({ onBack, onOpenSort, onCloseSort, onSortChange, onSwitchTab, onOpenGame, onCloseDetails, onRetry, onMeasureViewport }),
    [onBack, onOpenSort, onCloseSort, onSortChange, onSwitchTab, onOpenGame, onCloseDetails, onRetry, onMeasureViewport],
  );

  return (
    <HistoryContentView
      data={data}
      layout={layout}
      state={viewState}
      actions={actions}
      selectedResult={selectedResult}
    />
  );
};

function sortHistory(
  history: GameSession[],
  sortField: HistorySortField,
  sortDirection: SortDirection,
): GameSession[] {
  return [...history].sort((a, b) => {
    let comparison: number;
    switch (sortField) {
      case "date": {
        const aDate = Date.parse(a.date);
        const bDate = Date.parse(b.date);
        if (!Number.isFinite(aDate) || !Number.isFinite(bDate)) {
          return Number(!Number.isFinite(aDate)) - Number(!Number.isFinite(bDate)) || a.id.localeCompare(b.id);
        }
        comparison = bDate - aDate;
        break;
      }
      case "players":
        comparison = b.players.length - a.players.length;
        break;
      case "drinks":
        comparison = calculateTotalDrinks(b.players) - calculateTotalDrinks(a.players);
        break;
      case "goals":
        comparison = calculateTotalGoals(b.matches) - calculateTotalGoals(a.matches);
        break;
      case "matches":
        comparison = b.matches.length - a.matches.length;
        break;
      default:
        comparison = 0;
    }
    return (sortDirection === "desc" ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
}

function HistoryContentView({
  data,
  layout,
  state,
  actions,
  selectedResult,
}: {
  data: HistoryContentData;
  layout: HistoryLayout;
  state: HistoryViewState;
  actions: HistoryActions;
  selectedResult: GameSession | undefined;
}) {
  return data.history.length === 0
    ? <HistoryEmptyScreen data={data} layout={layout} actions={actions} />
    : <HistoryPage data={data} layout={layout} state={state} actions={actions} selectedResult={selectedResult} />;
}

function HistoryEmptyScreen({
  data,
  layout,
  actions,
}: Pick<Parameters<typeof HistoryContentView>[0], "data" | "layout" | "actions">) {
  const cloudStatus = <HistoryCloudStatus data={data} colors={layout.colors} onRetry={actions.onRetry} />;
  return (
    <SafeAreaView style={layout.styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={layout.shellWideLayout}
        contentMaxWidth={layout.shellWideLayout ? 1120 : undefined}
        contentProps={centeredContentProps}
      >
        <HistoryHeader onBack={actions.onBack} showSortButton={false} sortDirection="desc" onOpenSortModal={noop} />
        {cloudStatus}
        <View style={layout.styles.emptyStateContainer}>
          <AppIcon name="calendar-outline" size={60} color={layout.colors.neutralGray} />
          <Text style={layout.styles.emptyStateText}>
            {getHistoryEmptyMessage(data.loading, data.error)}
          </Text>
        </View>
      </ShellScreen>
    </SafeAreaView>
  );
}

function HistoryPage({
  data,
  layout,
  state,
  actions,
  selectedResult,
}: {
  data: HistoryContentData;
  layout: HistoryLayout;
  state: HistoryViewState;
  actions: HistoryActions;
  selectedResult: GameSession | undefined;
}) {
  return (
    <SafeAreaView style={layout.styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={layout.shellWideLayout}
        contentMaxWidth={layout.shellWideLayout ? 1120 : undefined}
        contentProps={centeredContentProps}
      >
        <HistoryHeader
          onBack={actions.onBack}
          showSortButton={state.activeTabIndex === 0}
          sortDirection={state.sortDirection}
          onOpenSortModal={actions.onOpenSort}
        />
        <HistoryCloudStatus data={data} colors={layout.colors} onRetry={actions.onRetry} />
        <SortHistoryModal
          visible={state.sortModalVisible}
          sortField={state.sortField}
          sortDirection={state.sortDirection}
          onClose={actions.onCloseSort}
          onSortChange={actions.onSortChange}
        />
        <HistoryTabBar
          activeTabIndex={state.activeTabIndex}
          styles={layout.styles}
          colors={layout.colors}
          wideLayout={layout.wideLayout}
          onSwitchTab={actions.onSwitchTab}
        />
        <View testID="HistoryContentViewport" style={historyLayoutStyles.viewport} onLayout={actions.onMeasureViewport}>
          <View style={historyLayoutStyles.tabPanels}>
            <HistoryTabContent
              data={data}
              layout={layout}
              activeTabIndex={state.activeTabIndex}
              sortField={state.sortField}
              sortDirection={state.sortDirection}
              onOpenGame={actions.onOpenGame}
            />
          </View>
        </View>
      </ShellScreen>
      {state.isDetailVisible && selectedResult && (
        <GameDetailsModal game={selectedResult} visible={state.isDetailVisible} onClose={actions.onCloseDetails} />
      )}
    </SafeAreaView>
  );
}

function HistoryCloudStatus({
  data,
  colors,
  onRetry,
}: {
  data: HistoryContentData;
  colors: HistoryColors;
  onRetry: () => void;
}) {
  if (!data.accountId || (!data.loading && !data.error)) return null;
  return (
    <View style={historyLayoutStyles.cloudStatus}>
      {data.loading && <ActivityIndicator accessibilityLabel="Loading cloud history" color={colors.primary} />}
      {data.error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{data.error}</Text>}
      {data.error && (
        <ShellActionButton
          accessibilityRole="button"
          variant="surface"
          widthMode="fit"
          label="Retry cloud history"
          disabled={data.loading}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

function HistoryTabBar({
  activeTabIndex,
  styles,
  colors,
  wideLayout,
  onSwitchTab,
}: {
  activeTabIndex: number;
  styles: HistoryStyles;
  colors: HistoryColors;
  wideLayout: boolean;
  onSwitchTab: (index: number) => void;
}) {
  return (
    <View style={[styles.tabsContainer, wideLayout && styles.tabsContainerWide]}>
      {TABS.map((tabName, index) => (
        <HistoryTabButton
          key={tabName}
          index={index}
          label={tabName}
          icon={TAB_ICONS[index]}
          selected={activeTabIndex === index}
          styles={styles}
          color={activeTabIndex === index ? colors.primary : colors.textMuted}
          onSwitchTab={onSwitchTab}
        />
      ))}
    </View>
  );
}

function HistoryTabButton({
  index,
  label,
  icon,
  selected,
  styles,
  color,
  onSwitchTab,
}: {
  index: number;
  label: string;
  icon: typeof TAB_ICONS[number];
  selected: boolean;
  styles: HistoryStyles;
  color: string;
  onSwitchTab: (index: number) => void;
}) {
  const handlePress = useCallback(() => onSwitchTab(index), [index, onSwitchTab]);
  const accessibilityState = useMemo(() => ({ selected }), [selected]);
  return (
    <TouchableOpacity
      testID={`HistoryTab-${label}`}
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      style={[styles.tab, selected && styles.activeTab]}
      onPress={handlePress}
    >
      <View style={styles.iconRow}>
        <AppIcon name={icon} size={18} color={color} />
        <Text style={[styles.tabText, selected && styles.activeTabText]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function HistoryTabContent({
  data,
  layout,
  activeTabIndex,
  sortField,
  sortDirection,
  onOpenGame,
}: {
  data: HistoryContentData;
  layout: HistoryLayout;
  activeTabIndex: number;
  sortField: HistorySortField;
  sortDirection: SortDirection;
  onOpenGame: (game: GameSession) => void;
}) {
  if (activeTabIndex === 0) {
    return (
      <View style={layout.styles.tabContent}>
        <HistoryGameList
          rows={data.gameRows}
          columns={layout.columns}
          wideLayout={layout.wideLayout}
          sortField={sortField}
          sortDirection={sortDirection}
          styles={layout.styles}
          colors={layout.colors}
          onOpenGame={onOpenGame}
        />
      </View>
    );
  }
  if (activeTabIndex === 1) {
    return (
      <View style={layout.styles.tabContent}>
        {data.playerStats.length > 0 ? (
          <PlayerStatsList playerStats={data.playerStats} history={data.history} availableWidth={layout.availableWidth} />
        ) : (
          <View style={layout.styles.emptyTabContent}>
            <AppIcon name="people-outline" size={40} color={layout.colors.neutralGray} />
            <Text style={layout.styles.emptyStateText}>No player data yet.</Text>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={layout.styles.tabContent}>
      <OverallStats history={data.history} availableWidth={layout.availableWidth} onGamePress={onOpenGame} />
    </View>
  );
}

function HistoryGameList({
  rows,
  columns,
  wideLayout,
  sortField,
  sortDirection,
  styles,
  colors,
  onOpenGame,
}: {
  rows: HistoryGameRow[];
  columns: number;
  wideLayout: boolean;
  sortField: HistorySortField;
  sortDirection: SortDirection;
  styles: HistoryStyles;
  colors: HistoryColors;
  onOpenGame: (game: GameSession) => void;
}) {
  const renderRow = useCallback(
    ({ item }: { item: HistoryGameRow }) => (
      <HistoryGameRowItem item={item} columns={columns} colors={colors} onOpenGame={onOpenGame} />
    ),
    [columns, colors, onOpenGame],
  );
  const contentContainerStyle = useMemo(
    () => [styles.listContent, wideLayout && styles.listContentWide],
    [styles.listContent, styles.listContentWide, wideLayout],
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={historyRowKeyExtractor}
      renderItem={renderRow}
      contentContainerStyle={contentContainerStyle}
      key={`games-list-${columns}-${sortField}-${sortDirection}`}
    />
  );
}

function HistoryGameRowItem({
  item,
  columns,
  colors,
  onOpenGame,
}: {
  item: HistoryGameRow;
  columns: number;
  colors: HistoryColors;
  onOpenGame: (game: GameSession) => void;
}) {
  const headingStyle = useMemo(
    () => ({ ...historyLayoutStyles.historyRowHeading, color: colors.textPrimary }),
    [colors.textPrimary],
  );
  return (
    <View style={historyLayoutStyles.historyRow}>
      {item.heading && <Text accessibilityRole="header" style={headingStyle}>{item.heading}</Text>}
      <View style={historyLayoutStyles.historyRowCards}>
        {item.games.map((game) => (
          <View key={game.id} style={historyLayoutStyles.historyRowCard}>
            <GameHistoryItem game={game} onDetailsPress={onOpenGame} />
          </View>
        ))}
        {columns === 2 && item.games.length === 1 && <View style={historyLayoutStyles.historyRowFiller} />}
      </View>
    </View>
  );
}

const historyRowKeyExtractor = (item: HistoryGameRow) => item.id;
const noop = () => undefined;

function getHistoryEmptyMessage(loading: boolean, error: string | null) {
  if (loading) return "Loading game history…";
  if (error) return "Cloud history is unavailable. You can retry above.";
  return "No game history yet. Play some games to see your stats and history here!";
}

export default HistoryScreen;
