import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHistory } from ".";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import AppIcon from "../../components/ui/AppIcon";
import { TaskOverlay } from "../../platform/navigation/taskNavigation";
import { useColors } from "../../styles/theme";
import { useFriends, type Person } from "../friends";
import GameDetailsModal from "./GameDetailsModal";
import GameHistoryItem from "./GameHistoryItem";
import HistoryHeader from "./HistoryHeader";
import { type HistoryGameRow } from "./historyLayout";
import HistoryStatistics from "./HistoryStatistics";
import { createHistoryStyles } from "./historyStyles";
import { GameSession, PlayerStat } from "./historyTypes";
import PlayerStatsList from "./PlayerStatsList";
import SortHistoryModal, {
  HistorySortField,
  SortDirection,
} from "./SortHistoryModal";

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

export interface HistoryViewState {
  selectedGame: GameSession | null;
  isDetailVisible: boolean;
  activeTabIndex: number;
  sortField: HistorySortField;
  sortDirection: SortDirection;
  sortModalVisible: boolean;
}

export type HistoryScreenState = ReturnType<typeof useHistory>;

type HistoryStyles = ReturnType<typeof createHistoryStyles>;

type HistoryColors = ReturnType<typeof useColors>;

export interface HistoryContentData extends Pick<HistoryScreenState, "history" | "loading" | "error" | "refresh" | "accountId"> {
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

export interface HistoryLayout {
  width: number;
  availableWidth: number;
  wideLayout: boolean;
  shellWideLayout: boolean;
  columns: number;
  styles: HistoryStyles;
  colors: HistoryColors;
}

export interface HistoryActions {
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

export function HistoryContentView({
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
    <View accessibilityRole="tablist" accessibilityLabel="History views" style={[styles.tabsContainer, wideLayout && styles.tabsContainerWide]}>
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
