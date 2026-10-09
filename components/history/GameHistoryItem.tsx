import React, { useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon, { type AppIconName } from "../AppIcon";
import { GameSession } from "./historyTypes";
import { useColors } from "../../styles/theme";
import {
  calculateTotalGoals,
  calculateTotalDrinks,
  findTopDrinker,
  formatHistoryDate,
  getPlayerIdentityKey,
} from "./historyUtils";
import MatchCard from "./MatchCard";

interface GameHistoryItemProps {
  game: GameSession;
  onDetailsPress: (game: GameSession) => void;
}

type HistoryItemColors = ReturnType<typeof useColors>;

const createHistoryItemStyles = (colors: HistoryItemColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    headerIcon: { marginRight: 8 },
    date: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    summary: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 8,
      marginBottom: 12,
    },
    summaryItem: {
      width: "48.5%",
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 9,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
    },
    summaryIcon: { marginRight: 7 },
    summaryText: {
      flex: 1,
      minWidth: 0,
    },
    summaryValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    sectionHeader: {
      marginBottom: 6,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    matchSection: {
      marginBottom: 12,
    },
    playerSection: {
      marginBottom: 11,
    },
    playerChips: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    playerChip: {
      maxWidth: "70%",
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.primaryLight,
    },
    playerChipText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    overflowChip: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.backgroundLight,
    },
    overflowText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    topDrinker: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    topDrinkerContent: {
      flex: 1,
      minWidth: 0,
      marginLeft: 7,
    },
    topDrinkerHeading: {
      marginBottom: 6,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    topDrinkerNames: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 5,
    },
    topDrinkerName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    topDrinkerChip: {
      maxWidth: "65%",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.backgroundLight,
    },
    detailsLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 42,
      marginTop: 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    detailsLinkText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    detailsIcon: { marginLeft: 5 },
  });

type HistoryItemStyles = ReturnType<typeof createHistoryItemStyles>;

const GameHistoryItem = React.memo(function GameHistoryItem({
  game,
  onDetailsPress,
}: GameHistoryItemProps) {
  const colors = useColors();
  const styles = useMemo(() => createHistoryItemStyles(colors), [colors]);
  const dateLabel = formatHistoryDate(game.date);
  const totalDrinks = calculateTotalDrinks(game.players);
  const totalGoals = calculateTotalGoals(game.matches);
  const topDrinkers = findTopDrinker(game.players);
  const commonMatch = game.matches.find((match) => match.id === game.commonMatchId);
  const previewMatch = commonMatch ?? game.matches[0] ?? null;
  const accessibilityLabel = createAccessibilityLabel({
    game,
    dateLabel,
    totalDrinks,
    totalGoals,
    previewMatch,
    topDrinkers,
  });
  const handlePress = useCallback(
    () => onDetailsPress(game),
    [game, onDetailsPress],
  );

  return (
    <TouchableOpacity
      testID={`HistoryGameItem-${game.id}`}
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the full game details"
    >
      <View style={styles.header}>
        <AppIcon
          name="calendar-outline"
          size={18}
          color={colors.primary}
          style={styles.headerIcon}
        />
        <Text style={styles.date}>
          {game.isEarlyLeaveResult ? `Left early · ${dateLabel}` : dateLabel}
        </Text>
      </View>

      <HistorySummary game={game} totalDrinks={totalDrinks} totalGoals={totalGoals} styles={styles} color={colors.primary} />
      <MatchPreview
        match={previewMatch}
        commonMatchId={game.commonMatchId}
        styles={styles}
      />
      <PlayerChips game={game} styles={styles} />
      <TopDrinkerSummary game={game} topDrinkers={topDrinkers} styles={styles} colors={colors} />
      <DetailsLink matchCount={game.matches.length} styles={styles} color={colors.primary} />
    </TouchableOpacity>
  );
});

interface AccessibilityLabelArgs {
  game: GameSession;
  dateLabel: string;
  totalDrinks: number;
  totalGoals: number;
  previewMatch: GameSession["matches"][number] | null;
  topDrinkers: ReturnType<typeof findTopDrinker>;
}

function createAccessibilityLabel({
  game,
  dateLabel,
  totalDrinks,
  totalGoals,
  previewMatch,
  topDrinkers,
}: AccessibilityLabelArgs) {
  const visiblePlayers = game.players.slice(0, 2);
  const hiddenPlayerCount = Math.max(0, game.players.length - visiblePlayers.length);
  const playerSummary = game.players.length > 0
    ? `Players: ${visiblePlayers.map((player) => player.name).join(", ")}${hiddenPlayerCount > 0 ? `, and ${hiddenPlayerCount} more` : ""}`
    : "No players recorded";
  const matchSummary = previewMatch
    ? `Match preview: ${previewMatch.homeTeam} ${previewMatch.homeGoals ?? 0} to ${previewMatch.awayGoals ?? 0} ${previewMatch.awayTeam}${previewMatch.id === game.commonMatchId ? ", common match" : ""}`
    : "";
  const topDrinkerSummary = topDrinkers.length > 0
    ? `Top drinker${topDrinkers.length === 1 ? "" : "s"}: ${topDrinkers.map((player) => player.name).join(", ")}, ${(topDrinkers[0].drinksTaken ?? 0).toFixed(1)} drinks each`
    : "";

  return [
    game.isEarlyLeaveResult ? "Result at departure; game not yet completed" : "",
    dateLabel,
    `${game.players.length} ${game.players.length === 1 ? "player" : "players"}`,
    playerSummary,
    `${totalDrinks.toFixed(1)} drinks`,
    `${totalGoals} ${totalGoals === 1 ? "goal" : "goals"}`,
    `${game.matches.length} ${game.matches.length === 1 ? "match" : "matches"}`,
    matchSummary,
    topDrinkerSummary,
  ].filter(Boolean).join(". ");
}

interface HistorySummaryProps {
  game: GameSession;
  totalDrinks: number;
  totalGoals: number;
  styles: HistoryItemStyles;
  color: string;
}

function HistorySummary({ game, totalDrinks, totalGoals, styles, color }: HistorySummaryProps) {
  const items = [
    { icon: "people", label: "Players", value: game.players.length },
    { icon: "beer", label: "Drinks", value: totalDrinks.toFixed(1) },
    { icon: "football", label: "Goals", value: totalGoals },
    { icon: "trophy", label: "Matches", value: game.matches.length },
  ] as const;

  return (
    <View style={styles.summary}>
      {items.map((item) => (
        <SummaryItem key={item.label} {...item} styles={styles} color={color} />
      ))}
    </View>
  );
}

function MatchPreview({
  match,
  commonMatchId,
  styles,
}: {
  match: GameSession["matches"][number] | null;
  commonMatchId: GameSession["commonMatchId"];
  styles: HistoryItemStyles;
}) {
  if (!match) return null;
  return (
    <View style={styles.matchSection}>
      <Text style={styles.sectionHeader}>Match preview</Text>
      <MatchCard match={match} isCommon={match.id === commonMatchId} compact />
    </View>
  );
}

function PlayerChips({ game, styles }: { game: GameSession; styles: HistoryItemStyles }) {
  if (game.players.length === 0) return null;
  const visiblePlayers = game.players.slice(0, 2);
  const hiddenPlayerCount = Math.max(0, game.players.length - visiblePlayers.length);

  return (
    <View style={styles.playerSection}>
      <Text style={styles.sectionHeader}>Players</Text>
      <View style={styles.playerChips}>
        {visiblePlayers.map((player, index) => (
          <View
            key={getPlayerIdentityKey(player, game.id, index)}
            style={styles.playerChip}
          >
            <Text style={styles.playerChipText} numberOfLines={1}>
              {player.name}
            </Text>
          </View>
        ))}
        {hiddenPlayerCount > 0 && (
          <View style={styles.overflowChip}>
            <Text style={styles.overflowText}>+{hiddenPlayerCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TopDrinkerSummary({
  game,
  topDrinkers,
  styles,
  colors,
}: {
  game: GameSession;
  topDrinkers: ReturnType<typeof findTopDrinker>;
  styles: HistoryItemStyles;
  colors: HistoryItemColors;
}) {
  if (topDrinkers.length === 0) return null;
  const visibleTopDrinkers = topDrinkers.slice(0, 2).map((player) => {
    const index = game.players.indexOf(player);
    return {
      player,
      key: getPlayerIdentityKey(player, game.id, Math.max(index, 0)),
    };
  });
  const hiddenCount = Math.max(0, topDrinkers.length - visibleTopDrinkers.length);

  return (
    <View style={styles.topDrinker}>
      <AppIcon name="flame" size={17} color={colors.warning} />
      <View style={styles.topDrinkerContent}>
        <Text style={styles.topDrinkerHeading}>
          {topDrinkers.length === 1 ? "Top drinker" : "Tied top drinkers"}
          {` · ${(topDrinkers[0].drinksTaken ?? 0).toFixed(1)} drinks`}
        </Text>
        <View style={styles.topDrinkerNames}>
          {visibleTopDrinkers.map(({ player, key }) => (
            <View key={key} style={styles.topDrinkerChip}>
              <Text style={styles.topDrinkerName} numberOfLines={1}>
                {player.name}
              </Text>
            </View>
          ))}
          {hiddenCount > 0 && (
            <View style={styles.overflowChip}>
              <Text style={styles.overflowText}>+{hiddenCount}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function DetailsLink({
  matchCount,
  styles,
  color,
}: {
  matchCount: number;
  styles: HistoryItemStyles;
  color: string;
}) {
  const extraMatches = matchCount - 1;
  const label = extraMatches > 0
    ? `View details · ${extraMatches} more ${extraMatches === 1 ? "match" : "matches"}`
    : "View details";

  return (
    <View style={styles.detailsLink}>
      <Text style={styles.detailsLinkText}>{label}</Text>
      <AppIcon name="chevron-forward" size={16} color={color} style={styles.detailsIcon} />
    </View>
  );
}

const SummaryItem: React.FC<{
  icon: AppIconName;
  label: string;
  value: string | number;
  color: string;
  styles: Pick<HistoryItemStyles, "summaryItem" | "summaryIcon" | "summaryText" | "summaryValue" | "summaryLabel">;
}> = ({ icon, label, value, color, styles }) => (
  <View style={styles.summaryItem}>
    <AppIcon name={icon} size={16} color={color} style={styles.summaryIcon} />
    <View style={styles.summaryText}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  </View>
);

export default GameHistoryItem;
