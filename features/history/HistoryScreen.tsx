import { HistoryActions, HistoryContentData, HistoryContentView, HistoryLayout, HistoryScreenState, HistoryViewState } from "./HistoryContentView";
import { sortHistory } from "./historySorting";
/**
 * @description Screen displaying historical game sessions, player cumulative stats, and overall statistics. Provides a tabbed interface (Games, Players, Stats) without gesture-based swiping for simplicity and accessibility.
 */
import { useFocusEffect, useIsFocused, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useHistory, useHistoryCoplayerContext } from ".";
import { ShellActionButton } from "../../components/ui";
import { backToRememberedDetailList, hasDetailListParent, rememberDetailListParent } from "../../platform/navigation/detailEntry";
import { historyParams, parseHistoryState, sameViewParams, withViewParams, type HistoryRouteState, type RouteParams } from "../../platform/navigation/routeState";
import { useNavigationReady } from "../../platform/navigation/useNavigationReady";
import { useGameStoreHydration } from "../../store/useGameStoreHydration";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import { useFriends, type Person } from "../friends";
import { calculateLifetimePlayerStats } from "./historyCalculations";
import { buildHistoryRows } from "./historyLayout";
import { createHistoryStyles } from "./historyStyles";
import { GameSession, PlayerStat } from "./historyTypes";
import { isAccountId } from "./socialHistoryRepository";
import {
  HistorySortField
} from "./SortHistoryModal";

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

export default HistoryScreen;
