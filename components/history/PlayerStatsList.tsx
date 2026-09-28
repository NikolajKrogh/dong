import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Text } from "tamagui";
import AppIcon from "../AppIcon";
import { GameSession, PlayerStat } from "./historyTypes";
import { useColors } from "../../styles/theme";
import PlayerDetailsModal from "./PlayerDetailsModal";
import PlayerComparisonModal from "./PlayerComparisonModal";

interface PlayerStatsListProps {
  playerStats: PlayerStat[];
  history: GameSession[];
  availableWidth?: number;
}

export default function PlayerStatsList({ playerStats, history, availableWidth }: PlayerStatsListProps) {
  const colors = useColors();
  const window = useWindowDimensions();
  const columns = (availableWidth ?? window.width) >= 1024 && window.fontScale < 1.5 ? 2 : 1;
  const [search, setSearch] = useState("");
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [comparing, setComparing] = useState(false);
  const rankedPlayers = useMemo(() => [...playerStats]
    .sort((a, b) => b.totalDrinks - a.totalDrinks || a.name.localeCompare(b.name) || a.identityKey.localeCompare(b.identityKey))
    .map((player, index) => ({ player, rank: index + 1 })), [playerStats]);
  const query = search.trim().toLocaleLowerCase();
  const filteredPlayers = rankedPlayers.filter(({ player }) =>
    [player.name, player.contextLabel ?? ""].some((value) => value.toLocaleLowerCase().includes(query)));
  const selectedPlayers = selectedKeys.flatMap((key) => {
    const player = playerStats.find((candidate) => candidate.identityKey === key);
    return player ? [player] : [];
  });
  const selectedPlayer = playerStats.find((player) => player.identityKey === selectedPlayerKey) ?? null;
  const maxDrinks = rankedPlayers[0]?.player.totalDrinks ?? 0;

  function selectPlayer(player: PlayerStat) {
    if (!selectionMode) {
      setSelectedPlayerKey(player.identityKey);
      return;
    }
    const current = selectedPlayers.map((candidate) => candidate.identityKey);
    const next = current.includes(player.identityKey)
      ? current.filter((key) => key !== player.identityKey)
      : [...current, player.identityKey].slice(0, 2);
    setSelectedKeys(next);
    if (next.length === 2) {
      setComparing(true);
      setSelectionMode(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={columns}
        data={filteredPlayers}
        numColumns={columns}
        keyExtractor={({ player }) => player.identityKey}
        contentContainerStyle={styles.content}
        columnWrapperStyle={columns > 1 ? styles.columns : undefined}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text accessibilityRole="header" color="$color" fontSize={23} fontWeight="700">Player rankings</Text>
                <Text color="$textMuted" fontSize={14}>Ranked by total drinks across your history</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectionMode ? "Cancel comparison" : "Compare players"}
                accessibilityState={{ disabled: playerStats.length < 2 }}
                disabled={playerStats.length < 2}
                onPress={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedKeys([]);
                }}
                style={[styles.compare, { backgroundColor: colors.primaryLight, opacity: playerStats.length < 2 ? 0.5 : 1 }]}
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
            {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear player search" onPress={() => setSearch("")} style={styles.clearSearch}>
              <AppIcon name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>}</View>
            <Text color="$textMuted" accessibilityLiveRegion="polite">{filteredPlayers.length} of {playerStats.length} player entries</Text>
            {selectionMode && <Text color="$textMuted" accessibilityLiveRegion="polite">
              Select two players ({selectedPlayers.length}/2){selectedPlayers.length ? ": " + selectedPlayers.map((player) => player.name).join(", ") : ""}
            </Text>}
          </View>
        }
        ListEmptyComponent={<Text color="$textMuted" paddingVertical="$5">{query ? "No players match your search." : "Player rankings will appear after your first game."}</Text>}
        renderItem={({ item: { player, rank } }) => {
          const selected = selectedKeys.includes(player.identityKey);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rank ${rank}, ${player.name}${player.contextLabel ? ", " + player.contextLabel : ""}, ${player.totalDrinks.toFixed(1)} drinks`}
              accessibilityState={{ selected }}
              onPress={() => selectPlayer(player)}
              style={[styles.card, {
                maxWidth: columns > 1 ? ((availableWidth ?? window.width) - 48) / 2 : "100%",
                backgroundColor: colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderWidth: selected ? 2 : 1,
              }]}
            >
              <View style={styles.titleRow}>
                <View style={[styles.rank, { backgroundColor: rank <= 3 ? colors.primaryLight : colors.backgroundSubtle }]}>
                  <Text color={rank <= 3 ? "$primary" : "$textMuted"} fontWeight="700">#{rank}</Text>
                </View>
                <View accessible={false} style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                  <Text color="$primary" fontWeight="700" fontSize={18}>{player.name.trim().slice(0, 1).toLocaleUpperCase() || "?"}</Text>
                </View>
                <View style={styles.titleCopy}>
                  <Text color="$color" fontSize={19} fontWeight="700">{player.name}</Text>
                  {player.contextLabel && <Text color="$textMuted" fontSize={13}>{player.contextLabel}</Text>}
                </View>
                <AppIcon name="chevron-forward" size={22} color={colors.primary} />
              </View>
              <View style={styles.metrics}>
                <View><Text color="$color" fontSize={25} fontWeight="700">{player.totalDrinks.toFixed(1)}</Text><Text color="$textMuted">Total drinks</Text></View>
                <View><Text color="$color" fontSize={20} fontWeight="600">{player.gamesPlayed}</Text><Text color="$textMuted">Games</Text></View>
                <View><Text color="$color" fontSize={20} fontWeight="600">{player.averagePerGame.toFixed(1)}</Text><Text color="$textMuted">Per game</Text></View>
              </View>
              <View accessible={false} style={[styles.barTrack, { backgroundColor: colors.backgroundSubtle }]}>
                <View style={[styles.bar, { backgroundColor: colors.primary, width: `${maxDrinks ? Math.min(100, Math.max(0, player.totalDrinks / maxDrinks * 100)) : 0}%` }]} />
              </View>
            </Pressable>
          );
        }}
      />
      <PlayerDetailsModal visible={selectedPlayer !== null} onClose={() => setSelectedPlayerKey(null)} player={selectedPlayer} gameHistory={history} />
      {comparing && selectedPlayers.length === 2 && <PlayerComparisonModal
        visible
        onClose={() => { setComparing(false); setSelectedKeys([]); }}
        player1={selectedPlayers[0]}
        player2={selectedPlayers[1]}
        gameHistory={history}
      />}
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
