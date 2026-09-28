import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "tamagui";
import AppIcon from "../AppIcon";
import { GameSession } from "./historyTypes";
import { useColors } from "../../styles/theme";
import { calculateLifetimePlayerStats, calculateTotalGoals, calculateTotalDrinks, formatHistoryDate } from "./historyUtils";
import PlayerDetailsModal from "./PlayerDetailsModal";

interface OverallStatsProps {
  history: GameSession[];
  availableWidth?: number;
  onGamePress?: (game: GameSession) => void;
}

export default function OverallStats({ history, availableWidth, onGamePress }: OverallStatsProps) {
  const colors = useColors();
  const window = useWindowDimensions();
  const width = availableWidth ?? window.width;
  const columns = window.fontScale >= 1.5 || width < 360 ? 1 : width >= 1024 ? 3 : 2;
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const playerStats = useMemo(() => calculateLifetimePlayerStats(history), [history]);
  const totalParticipations = history.reduce((sum, game) => sum + game.players.length, 0);
  const totalMatches = history.reduce((sum, game) => sum + game.matches.length, 0);
  const totalGoals = history.reduce((sum, game) => sum + calculateTotalGoals(game.matches), 0);
  const totalDrinks = history.reduce((sum, game) => sum + calculateTotalDrinks(game.players), 0);
  const rankedPlayers = [...playerStats].sort((a, b) => b.totalDrinks - a.totalDrinks || a.name.localeCompare(b.name) || a.identityKey.localeCompare(b.identityKey));
  const topPlayer = rankedPlayers[0];
  const tiedPlayers = topPlayer ? rankedPlayers.filter((player) => player.totalDrinks === topPlayer.totalDrinks).length : 0;
  const selectedPlayer = playerStats.find((player) => player.identityKey === selectedPlayerKey) ?? null;
  const rankedGames = [...history].sort((a, b) => calculateTotalGoals(b.matches) - calculateTotalGoals(a.matches) || a.id.localeCompare(b.id));
  const mostGoalsGame = rankedGames[0];
  const tiedGames = mostGoalsGame ? rankedGames.filter((game) => calculateTotalGoals(game.matches) === calculateTotalGoals(mostGoalsGame.matches)).length : 0;
  const metrics = [
    { label: "Total drinks", value: totalDrinks.toFixed(1), icon: "beer-outline" },
    { label: "Games", value: history.length.toString(), icon: "game-controller-outline" },
    { label: "Player participations", value: totalParticipations.toString(), icon: "people-outline" },
    { label: "Matches", value: totalMatches.toString(), icon: "trophy" },
    { label: "Goals", value: totalGoals.toString(), icon: "football-outline" },
    { label: "Avg. drinks per participation", value: totalParticipations ? (totalDrinks / totalParticipations).toFixed(1) : "0.0", icon: "flash-outline" },
  ] as const;
  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" color="$color" fontSize={23} fontWeight="700">Your history at a glance</Text>
        <Text color="$textMuted" fontSize={15}>Totals across the completed games in your history.</Text>
        <View style={styles.grid}>
          {metrics.map(({ label, value, icon }, index) => (
            <View key={label} style={[styles.tileSlot, { width: `${100 / columns}%` }]}>
              <View style={[styles.tile, { backgroundColor: index === 0 ? colors.primaryLight : colors.surface, borderColor: colors.border }]}>
                <AppIcon name={icon} size={24} color={colors.primary} />
                <Text color="$primary" fontSize={30} fontWeight="700">{value}</Text>
                <Text color="$textMuted" fontSize={15}>{label}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.explanation, { backgroundColor: colors.primaryLight }]}>
          <Text color="$color" fontSize={15}>
            A participation is one player in one game. The same person playing three games counts as three participations. Players who left early still count.
          </Text>
        </View>
        <Text accessibilityRole="header" color="$color" fontSize={21} fontWeight="700">Highlights</Text>
        {mostGoalsGame ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View most-goals game"
            accessibilityState={{ disabled: !onGamePress }}
            disabled={!onGamePress}
            onPress={() => onGamePress?.(mostGoalsGame)}
            style={[styles.highlight, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text color="$textMuted">Most goals in a game</Text>
            <Text color="$color" fontSize={22} fontWeight="700">{calculateTotalGoals(mostGoalsGame.matches)} goals</Text>
            <Text color="$textMuted">{formatHistoryDate(mostGoalsGame.date)} · {mostGoalsGame.players.length} players</Text>
            {tiedGames > 1 && <Text color="$textMuted">{tiedGames} games tied · Showing one</Text>}
            <Text color="$primary" fontWeight="600">View game details →</Text>
          </Pressable>
        ) : <Text color="$textMuted">Complete a game to see your highlights.</Text>}
        {topPlayer && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View top player ${topPlayer.name}`}
            onPress={() => setSelectedPlayerKey(topPlayer.identityKey)}
            style={[styles.highlight, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text color="$textMuted">Top player by total drinks</Text>
            <Text color="$color" fontSize={22} fontWeight="700">{topPlayer.name}</Text>
            {topPlayer.contextLabel && <Text color="$textMuted">{topPlayer.contextLabel}</Text>}
            <Text color="$textMuted">{topPlayer.totalDrinks.toFixed(1)} drinks · {topPlayer.gamesPlayed} games</Text>
            {tiedPlayers > 1 && <Text color="$textMuted">{tiedPlayers} players tied · Showing one</Text>}
            <Text color="$primary" fontWeight="600">View player details →</Text>
          </Pressable>
        )}
      </ScrollView>
      <PlayerDetailsModal visible={selectedPlayer !== null} player={selectedPlayer} onClose={() => setSelectedPlayerKey(null)} gameHistory={history} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  tileSlot: { padding: 6 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 20, gap: 8 },
  explanation: { borderRadius: 14, padding: 16 },
  highlight: { borderWidth: 1, borderRadius: 18, padding: 20, gap: 8, minHeight: 44 },
});
