import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Text } from "tamagui";
import AppIcon from "../AppIcon";
import type { GameSession, Player, PlayerStat } from "./historyTypes";
import { useColors } from "../../styles/theme";
import PlayerDetailsModal from "./PlayerDetailsModal";
import PlayerComparisonModal from "./PlayerComparisonModal";
import type { Person } from "../../features/friends";
import { getPlayerIdentityKey } from "./historyUtils";
import { getHistoryTimestamp } from "../../features/history/historyDate";

const EMPTY_SOCIAL_PEOPLE: Person[] = [];

function getPersonIdentityKey(person: Person): string {
  const registeredPlayer: Player = {
    id: person.account_id,
    name: person.username,
    accountId: person.account_id,
    membershipType: "registered",
  };
  return getPlayerIdentityKey(registeredPlayer, "", 0);
}

function getPersonRelationshipLabel(person: Person): string | null {
  switch (person.relationship) {
    case "friends":
      return "Friend · Shared history";
    case "none":
      return "Registered player";
    case "incoming":
    case "outgoing":
      return "Friend request pending";
    default:
      return null;
  }
}

function comparePlayerStats(
  left: PlayerStat,
  right: PlayerStat,
  prioritizeRecent: boolean,
  recentByKey: ReadonlyMap<string, number>,
): number {
  const priorityComparison = prioritizeRecent
    ? (recentByKey.get(right.identityKey) ?? 0) - (recentByKey.get(left.identityKey) ?? 0)
    : right.totalDrinks - left.totalDrinks;

  return priorityComparison
    || left.name.localeCompare(right.name)
    || left.identityKey.localeCompare(right.identityKey);
}

interface PlayerStatsListProps {
  playerStats: PlayerStat[];
  history: GameSession[];
  availableWidth?: number;
  socialPeople?: Person[];
  onOpenShared?: (accountId: string) => void;
  onAddFriend?: (person: Person) => void;
  friendBusyAccountId?: string | null;
  friendError?: string | null;
}

interface ComparisonState {
  selectedKeys: string[];
  selectionMode: boolean;
  comparing: boolean;
}

type ComparisonAction =
  | { type: "toggle-selection-mode" }
  | {
      type: "select-player";
      identityKey: string;
      availableIdentityKeys: ReadonlySet<string>;
    }
  | { type: "close-comparison" };

const initialComparisonState: ComparisonState = {
  selectedKeys: [],
  selectionMode: false,
  comparing: false,
};

function comparisonReducer(
  state: ComparisonState,
  action: ComparisonAction,
): ComparisonState {
  switch (action.type) {
    case "toggle-selection-mode":
      return {
        ...state,
        selectionMode: !state.selectionMode,
        selectedKeys: [],
      };
    case "select-player": {
      if (!state.selectionMode) return state;
      const currentKeys = state.selectedKeys.filter((key) =>
        action.availableIdentityKeys.has(key),
      );
      const selectedKeys = currentKeys.includes(action.identityKey)
        ? currentKeys.filter((key) => key !== action.identityKey)
        : [...currentKeys, action.identityKey].slice(0, 2);
      return selectedKeys.length === 2
        ? { selectedKeys, selectionMode: false, comparing: true }
        : { ...state, selectedKeys };
    }
    case "close-comparison":
      return { ...state, comparing: false, selectedKeys: [] };
  }
}

interface PlayerStatsCardProps {
  player: PlayerStat;
  rank: number;
  selected: boolean;
  maxDrinks: number;
  maxWidth: number | "100%";
  onSelectPlayer: (player: PlayerStat) => void;
  person?: Person;
  onAddFriend?: (person: Person) => void;
  friendBusyAccountId?: string | null;
}

const PlayerStatsCard = React.memo(function PlayerStatsCard({
  player,
  rank,
  selected,
  maxDrinks,
  maxWidth,
  onSelectPlayer,
  person,
  onAddFriend,
  friendBusyAccountId,
}: PlayerStatsCardProps) {
  const colors = useColors();
  const friendActionBusy = friendBusyAccountId != null;
  const friendActionPending = friendBusyAccountId === person?.account_id;
  const relationshipLabel = person ? getPersonRelationshipLabel(person) : null;
  const handlePress = useCallback(
    () => onSelectPlayer(player),
    [onSelectPlayer, player],
  );
  const accessibilityState = useMemo(() => ({ selected }), [selected]);
  const cardStyle = useMemo(
    () => [
      styles.card,
      {
        maxWidth,
        backgroundColor: colors.surface,
        borderColor: selected ? colors.primary : colors.border,
        borderWidth: selected ? 2 : 1,
      },
    ],
    [colors.border, colors.primary, colors.surface, maxWidth, selected],
  );
  const rankStyle = useMemo(
    () => [
      styles.rank,
      { backgroundColor: rank <= 3 ? colors.primaryLight : colors.backgroundSubtle },
    ],
    [colors.backgroundSubtle, colors.primaryLight, rank],
  );
  const avatarStyle = useMemo(
    () => [styles.avatar, { backgroundColor: colors.primaryLight }],
    [colors.primaryLight],
  );
  const barTrackStyle = useMemo(
    () => [styles.barTrack, { backgroundColor: colors.backgroundSubtle }],
    [colors.backgroundSubtle],
  );
  const barWidth = maxDrinks
    ? Math.min(100, Math.max(0, (player.totalDrinks / maxDrinks) * 100))
    : 0;
  const barStyle = useMemo(
    () => [
      styles.bar,
      {
        backgroundColor: colors.primary,
        width: `${barWidth}%` as `${number}%`,
      },
    ],
    [barWidth, colors.primary],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}, ${player.name}${player.contextLabel ? ", " + player.contextLabel : ""}, ${player.totalDrinks.toFixed(1)} drinks`}
      accessibilityState={accessibilityState}
      onPress={handlePress}
      style={cardStyle}
    >
      <View style={styles.titleRow}>
        <View style={rankStyle}>
          <Text color={rank <= 3 ? "$primary" : "$textMuted"} fontWeight="700">#{rank}</Text>
        </View>
        <View accessible={false} style={avatarStyle}>
          <Text color="$primary" fontWeight="700" fontSize={18}>{player.name.trim().slice(0, 1).toUpperCase() || "?"}</Text>
        </View>
        <View style={styles.titleCopy}>
          <Text color="$color" fontSize={19} fontWeight="700">{player.name}</Text>
          {player.contextLabel && <Text color="$textMuted" fontSize={13}>{player.contextLabel}</Text>}
        </View>
        <AppIcon name="chevron-forward" size={22} color={colors.primary} />
      </View>
      {person && relationshipLabel ? (
        <Text color="$textMuted">
          {person.username} · {relationshipLabel}
        </Text>
      ) : null}
      {person?.relationship === "none" && onAddFriend ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${person.username} as friend`}
          style={styles.compare}
          disabled={friendActionBusy}
          accessibilityState={{ disabled: friendActionBusy }}
          onPress={(event) => {
            event.stopPropagation();
            onAddFriend(person);
          }}
        >
          <Text color="$primary">{friendActionPending ? "Working…" : "Add friend"}</Text>
        </Pressable>
      ) : null}
      <View style={styles.metrics}>
        <View>
          <Text color="$color" fontSize={25} fontWeight="700">{player.totalDrinks.toFixed(1)}</Text>
          <Text color="$textMuted">Total drinks</Text>
        </View>
        <View>
          <Text color="$color" fontSize={20} fontWeight="600">{player.gamesPlayed}</Text>
          <Text color="$textMuted">Games</Text>
        </View>
        <View>
          <Text color="$color" fontSize={20} fontWeight="600">{player.averagePerGame.toFixed(1)}</Text>
          <Text color="$textMuted">Per game</Text>
        </View>
      </View>
      <View accessible={false} style={barTrackStyle}>
        <View style={barStyle} />
      </View>
    </Pressable>
  );
});

export default function PlayerStatsList({
  playerStats,
  history,
  availableWidth,
  socialPeople = EMPTY_SOCIAL_PEOPLE,
  onOpenShared,
  onAddFriend,
  friendBusyAccountId,
  friendError,
}: PlayerStatsListProps) {
  const window = useWindowDimensions();
  const columns = (availableWidth ?? window.width) >= 1024 && window.fontScale < 1.5 ? 2 : 1;
  const [search, setSearch] = useState("");
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const [comparisonState, dispatch] = React.useReducer(
    comparisonReducer,
    initialComparisonState,
  );
  const { selectedKeys, selectionMode, comparing } = comparisonState;
  const peopleByKey = useMemo(
    () => new Map(socialPeople.map((person) => [getPersonIdentityKey(person), person])),
    [socialPeople],
  );
  const recentByKey = useMemo(() => {
    const dates = new Map<string, number>();
    history.forEach((game) => {
      const timestamp = getHistoryTimestamp(game.date) ?? 0;
      game.players.forEach((player, index) => {
        const identityKey = getPlayerIdentityKey(player, game.id, index);
        dates.set(identityKey, Math.max(dates.get(identityKey) ?? 0, timestamp));
      });
    });
    return dates;
  }, [history]);
  const rankedPlayers = useMemo(
    () => [...playerStats]
      .sort((left, right) => comparePlayerStats(left, right, !!onOpenShared, recentByKey))
      .map((player, index) => ({ player, rank: index + 1 })),
    [onOpenShared, playerStats, recentByKey],
  );
  const query = search.trim().toLocaleLowerCase();
  const filteredPlayers = useMemo(
    () => rankedPlayers.filter(({ player }) =>
      [player.name, player.contextLabel ?? ""].some((value) => value.toLocaleLowerCase().includes(query))),
    [query, rankedPlayers],
  );
  const playersByKey = useMemo(
    () => new Map(playerStats.map((player) => [player.identityKey, player])),
    [playerStats],
  );
  const availableIdentityKeys = useMemo(
    () => new Set(playersByKey.keys()),
    [playersByKey],
  );
  const selectedPlayers = selectedKeys.flatMap((key) => {
    const player = playersByKey.get(key);
    return player ? [player] : [];
  });
  const selectedPlayer = playerStats.find((player) => player.identityKey === selectedPlayerKey) ?? null;
  const maxDrinks = playerStats.reduce((maximum, player) => Math.max(maximum, player.totalDrinks), 0);
  const cardMaxWidth: number | "100%" = columns > 1
    ? ((availableWidth ?? window.width) - 48) / 2
    : "100%";

  const selectPlayer = useCallback((player: PlayerStat) => {
    if (!selectionMode) {
      const person = peopleByKey.get(player.identityKey);
      if (person?.relationship === "friends" && onOpenShared) {
        onOpenShared(person.account_id);
        return;
      }
      setSelectedPlayerKey(player.identityKey);
      return;
    }
    dispatch({
      type: "select-player",
      identityKey: player.identityKey,
      availableIdentityKeys,
    });
  }, [availableIdentityKeys, selectionMode, peopleByKey, onOpenShared]);
  const handleToggleComparison = useCallback(() => {
    dispatch({ type: "toggle-selection-mode" });
  }, []);
  const handleCloseDetails = useCallback(() => setSelectedPlayerKey(null), []);
  const handleCloseComparison = useCallback(() => {
    dispatch({ type: "close-comparison" });
  }, []);
  const handleClearSearch = useCallback(() => setSearch(""), []);
  const renderPlayer = useCallback(({ item: { player, rank } }: { item: { player: PlayerStat; rank: number } }) => (
    <PlayerStatsCard
      player={player}
      rank={rank}
      selected={selectedKeys.includes(player.identityKey)}
      maxDrinks={maxDrinks}
      maxWidth={cardMaxWidth}
      onSelectPlayer={selectPlayer}
      person={peopleByKey.get(player.identityKey)}
      onAddFriend={onAddFriend}
      friendBusyAccountId={friendBusyAccountId}
    />
  ), [cardMaxWidth, maxDrinks, selectPlayer, selectedKeys, peopleByKey, onAddFriend, friendBusyAccountId]);

  return (
    <View style={styles.container}>
      {friendError ? <Text color="$danger" accessibilityRole="alert">{friendError}</Text> : null}
      <FlatList
        key={columns}
        data={filteredPlayers}
        numColumns={columns}
        keyExtractor={({ player }) => player.identityKey}
        contentContainerStyle={styles.content}
        columnWrapperStyle={columns > 1 ? styles.columns : undefined}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <PlayerStatsHeader
            playerCount={playerStats.length}
            filteredCount={filteredPlayers.length}
            selectedPlayers={selectedPlayers}
            selectionMode={selectionMode}
            search={search}
            setSearch={setSearch}
            handleClearSearch={handleClearSearch}
            handleToggleComparison={handleToggleComparison}
            recent={!!onOpenShared}
          />
        }
        ListEmptyComponent={<Text color="$textMuted" paddingVertical="$5">{query ? "No players match your search." : "Player rankings will appear after your first game."}</Text>}
        renderItem={renderPlayer}
      />
      <PlayerDetailsModal visible={selectedPlayer !== null} onClose={handleCloseDetails} player={selectedPlayer} gameHistory={history} />
      {comparing && selectedPlayers.length === 2 && <PlayerComparisonModal
        visible
        onClose={handleCloseComparison}
        player1={selectedPlayers[0]}
        player2={selectedPlayers[1]}
        gameHistory={history}
      />}
    </View>
  );
}

function PlayerStatsHeader({ playerCount, filteredCount, selectedPlayers, selectionMode, search, setSearch, handleClearSearch, handleToggleComparison, recent }: {
  playerCount: number;
  filteredCount: number;
  selectedPlayers: PlayerStat[];
  selectionMode: boolean;
  search: string;
  setSearch: (value: string) => void;
  handleClearSearch: () => void;
  handleToggleComparison: () => void;
  recent: boolean;
}) {
  const colors = useColors();
  return (
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text accessibilityRole="header" color="$color" fontSize={23} fontWeight="700">{recent ? 'Players' : 'Player rankings'}</Text>
                <Text color="$textMuted" fontSize={14}>{recent ? 'Most recent game together first · Select a friend for shared history' : 'Ranked by total drinks across your history'}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectionMode ? "Cancel comparison" : "Compare players"}
                accessibilityState={{ disabled: playerCount < 2 }}
                disabled={playerCount < 2}
                onPress={handleToggleComparison}
                style={[styles.compare, { backgroundColor: colors.primaryLight, opacity: playerCount < 2 ? 0.5 : 1 }]}
              >
                <Text color="$primary" fontWeight="600">{selectionMode ? "Cancel" : "Compare"}</Text>
              </Pressable>
            </View>
            <View style={styles.searchRow}><TextInput
              accessibilityLabel="Search players"
              placeholder="Search players"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              style={[styles.search, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear player search" onPress={handleClearSearch} style={styles.clearSearch}>
              <AppIcon name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>}</View>
            <Text color="$textMuted" accessibilityLiveRegion="polite">{filteredCount} of {playerCount} player entries</Text>
            {selectionMode && <Text color="$textMuted" accessibilityLiveRegion="polite">
              Select two players ({selectedPlayers.length}/2){selectedPlayers.length ? ": " + selectedPlayers.map((player) => player.name).join(", ") : ""}
            </Text>}
          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  titleCopy: { flex: 1, minWidth: 120, gap: 4 },
  compare: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, minHeight: 48 },
  clearSearch: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  columns: { gap: 16 },
  card: { flex: 1, minWidth: 0, borderRadius: 18, padding: 20, marginBottom: 16, gap: 20 },
  rank: { padding: 10, minWidth: 44, borderRadius: 12, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3 },
});
