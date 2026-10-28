/**
 * @description Screen displaying historical game sessions, player cumulative stats, and overall statistics. Provides a tabbed interface (Games, Players, Stats) without gesture-based swiping for simplicity and accessibility.
 */
import { useFocusEffect, useIsFocused, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  FlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../../components/ui/AppIcon";
import GameDetailsModal from "./GameDetailsModal";
import GameHistoryItem from "./GameHistoryItem";
import { buildHistoryRows, type HistoryGameRow } from "./historyLayout";
import HistoryHeader from "./HistoryHeader";
import { GameSession, PlayerStat } from "./historyTypes";
import {
  calculateLifetimePlayerStats,
  calculateTotalDrinks,
  calculateTotalGoals,
} from "./historyUtils";
import HistoryStatistics from "./HistoryStatistics";
import PlayerStatsList from "./PlayerStatsList";
import SortHistoryModal, {
  HistorySortField,
  SortDirection,
} from "./SortHistoryModal";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useHistory, useHistoryCoplayerContext } from ".";
import { getHistoryTimestamp } from "./historyDate";
import { isAccountId } from "./socialHistoryRepository";
import { useFriends, type Person } from "../friends";
import { createHistoryStyles } from "./historyStyles";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import { useGameStoreHydration } from "../../store/useGameStoreHydration";
import { useNavigationReady } from "../../platform/navigation/useNavigationReady";
import { TaskOverlay } from "../../platform/navigation/taskNavigation";
import { hasDetailListParent, rememberDetailListParent, backToRememberedDetailList } from "../../platform/navigation/detailEntry";
import { historyParams, parseHistoryState, sameViewParams, withViewParams, type HistoryRouteState, type RouteParams } from "../../platform/navigation/routeState";

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

type HistoryScreenState = ReturnType<typeof useHistory>;
type HistoryStyles = ReturnType<typeof createHistoryStyles>;
type HistoryColors = ReturnType<typeof useColors>;

interface HistoryContentData extends Pick<HistoryScreenState, "history" | "loading" | "error" | "refresh" | "accountId"> {
  playerStats: PlayerStat[];
  gameRows: HistoryGameRow[];
  socialPeople: Person[];
  onOpenShared: (accountId: string) => void;
  onAddFriend: (person: Person) => void;
  friendBusyAccountId: string | null;
  friendError: string | null;
  friendList: ReturnType<typeof useFriends>;
  statsTargetId: string;
  onSelectStatsTarget: (id: string) => void;
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
  const hydrated = useGameStoreHydration();
  const params = useLocalSearchParams() as RouteParams;
  const route = parseHistoryState(params, historyState.accountId);
  const { refresh } = historyState;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return (
    <HistoryContent
      key={`${historyState.accountId ?? "local"}:${route.friendId || "default"}`}
      route={route}
      params={params}
      {...historyState}
      loading={historyState.loading || !hydrated}
    />
  );
};

interface HistoryContentProps extends HistoryScreenState {
  route: HistoryRouteState;
  params: RouteParams;
}

const HistoryContent = ({ route, params, ...historyState }: HistoryContentProps) => {
  const routeFocused = useIsFocused();
  const router = useRouter();
  const navigationReady = useNavigationReady();
  const navigation = useNavigation();
  const openedFromList = useRef(false);
  const anchoredDetail = useRef("");
  const statsTargetId = route.friendId;
  const { history, loading, error, refresh, accountId } = historyState;
  const coplayers = useHistoryCoplayerContext(
    history.flatMap((game) => game.players.flatMap((player) =>
      player.membershipType === "registered" && player.accountId ? [player.accountId] : [])),
  );
  const friends = useFriends('friends');
  const onAddFriend = useCallback((person: Person) => {
    void friends.act("send", person);
  }, [friends]);
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const availableWidth = Math.min(measuredWidth ?? width, width, 1120);
  const wideLayout = isWideLayout(availableWidth);
  const shellWideLayout = isWideLayout(width);
  const columns = wideLayout && fontScale < 1.5 ? 2 : 1;
  const [sortModalVisible, setSortModalVisible] = useState(false);
  // This records a failed external navigation, even after its URL is normalized.
  const [unavailableGame, reportUnavailableGame] = React.useReducer(() => true, false);
  const selectedGame = history.find(game => game.id === route.gameId) ?? null;
  const { sort: sortField, direction: sortDirection } = route;
  const viewState: HistoryViewState = {
    selectedGame,
    isDetailVisible: selectedGame !== null,
    activeTabIndex: ["games", "players", "stats"].indexOf(route.tab),
    sortField,
    sortDirection,
    sortModalVisible,
  };

  const navigateView = useCallback((next: HistoryRouteState, replace = false) => {
    const nextParams = withViewParams(params, historyParams(next));
    if (sameViewParams(params, nextParams)) return;
    const target = { pathname: "/history" as const, params: nextParams };
    if (replace) router.setParams(historyParams(next));
    else router.push(target);
  }, [params, router]);
  useEffect(() => {
    if (!navigationReady || loading) return;
    const game = route.gameId ? history.find(item => item.id === route.gameId) ?? null : null;
    const next = route.gameId && !game && !error ? { ...route, gameId: "" } : route;
    if (game && anchoredDetail.current !== route.gameId) {
      anchoredDetail.current = route.gameId;
      const stack = navigation.getState();
      const previous = stack?.routes[(stack?.index ?? 0) - 1];
      const previousView = parseHistoryState((previous?.params ?? {}) as RouteParams);
      if (!hasDetailListParent() && (previous?.name !== "history" || previousView.gameId || previousView.tab !== "games")) {
        const listParams = withViewParams(params, historyParams({ ...route, gameId: "" }));
        // A direct detail needs its own list below it so browser Back dismisses it first.
        router.replace({ pathname: "/history", params: listParams });
        router.push({ pathname: "/history", params });
        return;
      }
    }
    if (route.gameId && !game && !error) reportUnavailableGame();
    if (!route.gameId) openedFromList.current = false;
    navigateView(next, true);
    if (game) return rememberDetailListParent(game.id);
  }, [navigationReady, loading, error, history, route, params, navigation, router, navigateView]);

  const targetFriendLoaded = friends.items.some(
    (person) => person.account_id === statsTargetId && person.relationship === "friends",
  );
  const {
    hasNextPage: hasMoreFriends,
    isFetching: isFetchingFriends,
    isFetchingNextPage: isFetchingMoreFriends,
    isError: friendsLoadFailed,
    error: friendsLoadError,
    fetchNextPage: fetchNextFriendPage,
  } = friends.list;
  useEffect(() => {
    if (
      !statsTargetId
      || !isAccountId(statsTargetId)
      || !friends.enabled
      || statsTargetId === friends.id
      || targetFriendLoaded
      || !hasMoreFriends
      || isFetchingFriends
      || isFetchingMoreFriends
      || friendsLoadFailed
      || friendsLoadError
    ) {
      return;
    }
    void fetchNextFriendPage();
  }, [
    statsTargetId,
    friends.enabled,
    friends.id,
    friends.items,
    targetFriendLoaded,
    hasMoreFriends,
    isFetchingFriends,
    isFetchingMoreFriends,
    friendsLoadFailed,
    friendsLoadError,
    fetchNextFriendPage,
  ]);

  const onOpenShared = useCallback((targetId: string) => {
    navigateView({ ...route, tab: "stats", friendId: targetId === accountId ? "" : targetId, gameId: "" });
  }, [route, navigateView, accountId]);
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
    setSortModalVisible(false);
    const direction = field === sortField && sortDirection === "desc" ? "asc" : "desc";
    navigateView({ ...route, sort: field, direction }, true);
  }, [route, sortField, sortDirection, navigateView]);
  const onSwitchTab = useCallback((index: number) => {
    navigateView({ ...route, tab: ["games", "players", "stats"][index] as HistoryRouteState["tab"], friendId: index === 2 ? statsTargetId : "", gameId: "" });
  }, [route, statsTargetId, navigateView]);
  const onOpenGame = useCallback((game: GameSession) => {
    if (!game) {
      console.warn("Attempted to open details for null game");
      return;
    }
    openedFromList.current = true;
    navigateView({ ...route, tab: "games", friendId: "", gameId: game.id });
  }, [route, navigateView]);
  const onCloseDetails = useCallback(() => {
    const stack = navigation.getState();
    const previous = stack?.routes[(stack?.index ?? 0) - 1];
    const previousIsList = previous?.name === "history" && !parseHistoryState((previous.params ?? {}) as RouteParams).gameId;
    if (router.canGoBack() && (openedFromList.current || previousIsList)) router.back();
    else if (!backToRememberedDetailList()) navigateView({ ...route, gameId: "" }, true);
    openedFromList.current = false;
  }, [navigation, router, route, navigateView]);
  const onBack = useCallback(() => router.canGoBack() ? router.back() : router.replace("/"), [router]);
  const onOpenSort = useCallback(() => {
    setSortModalVisible(true);
  }, []);
  const onCloseSort = useCallback(() => {
    setSortModalVisible(false);
  }, []);
  const onRetry = useCallback(() => { void refresh(); }, [refresh]);
  const onMeasureViewport = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setMeasuredWidth(nextWidth);
  }, []);

  const data = useMemo<HistoryContentData>(
    () => ({
      history,
      loading,
      error,
      refresh,
      accountId,
      playerStats,
      gameRows,
      socialPeople: coplayers,
      onOpenShared,
      onAddFriend,
      friendBusyAccountId: friends.busy,
      friendError: friends.actionError,
      friendList: friends,
      statsTargetId,
      onSelectStatsTarget: onOpenShared,
    }),
    [
      history,
      loading,
      error,
      refresh,
      accountId,
      playerStats,
      gameRows,
      coplayers,
      onOpenShared,
      onAddFriend,
      friends,
      statsTargetId,
    ],
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
      recovery={unavailableGame ? <View><Text accessibilityRole="alert">This game is unavailable on this device or account.</Text><ShellActionButton label="Home" href="/" /></View> : null}
      data={data}
      layout={layout}
      state={{ ...viewState, isDetailVisible: viewState.isDetailVisible && routeFocused }}
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
        const aDate = getHistoryTimestamp(a.date);
        const bDate = getHistoryTimestamp(b.date);
        if (aDate === null || bDate === null) {
          return Number(aDate === null) - Number(bDate === null) || a.id.localeCompare(b.id);
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
  recovery,
  data,
  layout,
  state,
  actions,
  selectedResult,
}: {
  recovery?: React.ReactNode;
  data: HistoryContentData;
  layout: HistoryLayout;
  state: HistoryViewState;
  actions: HistoryActions;
  selectedResult: GameSession | undefined;
}) {
  return data.history.length === 0 && state.activeTabIndex === 0
    ? <HistoryEmptyScreen recovery={recovery} data={data} layout={layout} actions={actions} />
    : <HistoryPage recovery={recovery} data={data} layout={layout} state={state} actions={actions} selectedResult={selectedResult} />;
}

function HistoryEmptyScreen({
  recovery,
  data,
  layout,
  actions,
}: Pick<Parameters<typeof HistoryContentView>[0], "recovery" | "data" | "layout" | "actions">) {
  const cloudStatus = <HistoryCloudStatus data={data} colors={layout.colors} onRetry={actions.onRetry} />;
  return (
    <SafeAreaView style={layout.styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={layout.shellWideLayout}
        contentMaxWidth={layout.shellWideLayout ? 1120 : undefined}
        contentProps={centeredContentProps}
      >
        <HistoryHeader title="History" onBack={actions.onBack} showSortButton={false} sortDirection="desc" onOpenSortModal={noop} />
        {recovery}
        {cloudStatus}
        <HistoryTabBar activeTabIndex={0} styles={layout.styles} colors={layout.colors}
          wideLayout={layout.wideLayout} onSwitchTab={actions.onSwitchTab} />
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
  recovery,
  data,
  layout,
  state,
  actions,
  selectedResult,
}: {
  recovery?: React.ReactNode;
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
          title="History"
          onBack={actions.onBack}
          showSortButton={state.activeTabIndex === 0}
          sortDirection={state.sortDirection}
          onOpenSortModal={actions.onOpenSort}
        />
        {recovery}
        <HistoryCloudStatus data={data} colors={layout.colors} onRetry={actions.onRetry} />
        <TaskOverlay open={state.sortModalVisible} onClose={actions.onCloseSort} fallbackHref="/history">
          {({ open, dismiss, runAfterDismiss }) => <SortHistoryModal
            visible={open}
            sortField={state.sortField}
            sortDirection={state.sortDirection}
            onClose={dismiss}
            onSortChange={field => runAfterDismiss(() => actions.onSortChange(field))}
          />}
        </TaskOverlay>
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
        <GameDetailsModal game={selectedResult} visible={state.isDetailVisible} onClose={actions.onCloseDetails}
          socialPeople={data.socialPeople} onOpenShared={data.onOpenShared} />
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
      {...(Platform.OS === "web" ? { "aria-selected": selected } : {})}
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
          <PlayerStatsList
            playerStats={data.playerStats}
            history={data.history}
            availableWidth={layout.availableWidth}
            socialPeople={data.socialPeople}
            onOpenShared={data.onOpenShared}
            onAddFriend={data.onAddFriend}
            friendBusyAccountId={data.friendBusyAccountId}
            friendError={data.friendError}
          />
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
      <HistoryStatistics
        history={data.history}
        friends={data.friendList}
        targetId={data.statsTargetId}
        onSelect={data.onSelectStatsTarget}
      />
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
