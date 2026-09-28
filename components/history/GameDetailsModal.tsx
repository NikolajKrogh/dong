import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GameSession } from "./historyTypes";
import { useColors } from "../../styles/theme";
import {
  formatModalDate,
  calculateTotalGoals,
  calculateTotalDrinks,
  getPlayerIdentityKey,
} from "./historyUtils";
import MatchCard from "./MatchCard";
import HistoryModalFrame from "./HistoryModalFrame";

interface GameDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  game: GameSession | null;
}

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  visible,
  onClose,
  game,
}) => {
  if (!game) return null;
  return (
    <HistoryModalFrame
      visible={visible}
      onClose={onClose}
      title="Game details"
      closeLabel="Close game details"
      testID="GameDetailsModalView"
    >
      {(layout) => <GameDetailsContent game={game} {...layout} />}
    </HistoryModalFrame>
  );
};

function GameDetailsContent({
  game,
  contentWidth,
  fontScale,
  isDesktop,
}: {
  game: GameSession;
  contentWidth: number;
  fontScale: number;
  isDesktop: boolean;
}) {
  const colors = useColors();
  const columns =
    contentWidth < 360 || fontScale >= 1.5 ? 1 : isDesktop ? 4 : 2;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        date: {
          marginBottom: 14,
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: "600",
          textAlign: "center",
        },
        summaryCard: {
          marginBottom: 20,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.backgroundLight,
        },
        summaryGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 8,
        },
        stat: {
          width: columns === 1 ? "100%" : columns === 4 ? "23.5%" : "48.5%",
          minHeight: 68,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: colors.surface,
        },
        statText: {
          flex: 1,
          minWidth: 0,
          marginLeft: 8,
        },
        statValue: {
          color: colors.textPrimary,
          fontSize: 17,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        },
        statLabel: {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: "600",
        },
        sections: { flexDirection: isDesktop ? "row" : "column", gap: 18 },
        section: {
          flex: isDesktop ? 1 : undefined,
          minWidth: 0,
          marginBottom: 20,
        },
        assignments: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 8,
        },
        assignment: {
          maxWidth: "100%",
          padding: 8,
          borderRadius: 10,
          backgroundColor: colors.primaryLight,
        },
        assignmentText: {
          color: colors.textSecondary,
          fontSize: 13,
          flexShrink: 1,
        },
        sectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
        },
        sectionTitle: {
          marginLeft: 7,
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "800",
        },
        playerCard: {
          flexDirection: columns === 1 ? "column" : "row",
          gap: 8,
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 8,
          padding: 12,
          borderRadius: 14,
          backgroundColor: colors.backgroundLight,
        },
        playerInfo: {
          flex: columns === 1 ? undefined : 1,
          width: columns === 1 ? "100%" : undefined,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "flex-start",
          marginRight: 10,
        },
        playerAvatar: {
          minWidth: 34,
          minHeight: 34,
          padding: 6,
          marginRight: 9,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryLight,
        },
        playerAvatarText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: "800",
        },
        playerDetails: {
          flex: 1,
          minWidth: 0,
        },
        playerName: {
          marginBottom: 3,
          color: colors.textPrimary,
          fontSize: 14,
          fontWeight: "700",
        },
        playerMeta: {
          marginTop: 3,
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 19,
        },
        drinkBadge: {
          minWidth: 56,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 9,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: colors.primary,
        },
        drinkCount: {
          marginLeft: 4,
          color: colors.white,
          fontSize: 13,
          fontWeight: "800",
        },
        matchCard: {
          marginBottom: 8,
        },
        empty: {
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.backgroundLight,
          color: colors.textMuted,
          fontSize: 13,
        },
      }),
    [colors, columns, isDesktop],
  );

  const totalGoals = calculateTotalGoals(game.matches);
  const totalDrinks = calculateTotalDrinks(game.players);
  const sortedPlayers = [...game.players].sort(
    (leftPlayer, rightPlayer) =>
      (rightPlayer.drinksTaken || 0) - (leftPlayer.drinksTaken || 0),
  );

  return (
    <>
      <Text style={styles.date}>{formatModalDate(game.date)}</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryGrid}>
          <StatItem
            icon="beer"
            label="Total drinks"
            value={totalDrinks.toFixed(1)}
            styles={styles}
            color={colors.primary}
          />
          <StatItem
            icon="football"
            label="Total goals"
            value={totalGoals}
            styles={styles}
            color={colors.primary}
          />
          <StatItem
            icon="people"
            label="Players"
            value={game.players.length}
            styles={styles}
            color={colors.primary}
          />
          <StatItem
            icon="trophy"
            label="Matches"
            value={game.matches.length}
            styles={styles}
            color={colors.primary}
          />
        </View>
      </View>

      <View testID="GameDetailsSections" style={styles.sections}>
        <View style={styles.section}>
          <SectionHeader
            title="Players"
            icon="people-outline"
            color={colors.textSecondary}
            styles={styles}
          />
          {sortedPlayers.length === 0 ? (
            <Text style={styles.empty}>No players recorded</Text>
          ) : (
            sortedPlayers.map((player) => {
              const playerIndex = game.players.indexOf(player);
              const assignedMatches = game.matches.filter((match) =>
                game.playerAssignments?.[player.id]?.includes(match.id),
              );

              return (
                <View
                  key={getPlayerIdentityKey(
                    player,
                    game.id,
                    Math.max(playerIndex, 0),
                  )}
                  style={styles.playerCard}
                >
                  <View style={styles.playerInfo}>
                    <View style={styles.playerAvatar} accessible={false}>
                      <Text style={styles.playerAvatarText}>
                        {player.name.trim().slice(0, 1).toLocaleUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                    <View style={styles.playerDetails}>
                      <Text style={styles.playerName}>{player.name}</Text>
                      {player.leftAt && (
                        <Text style={styles.playerMeta}>Left early</Text>
                      )}
                      <Text style={styles.playerMeta}>Final assignments</Text>
                      <View style={styles.assignments}>
                        {assignedMatches.length === 0 ? (
                          <Text style={styles.playerMeta}>No assignments</Text>
                        ) : (
                          assignedMatches.map((match) => (
                            <View key={match.id} style={styles.assignment}>
                              <Text style={styles.assignmentText}>
                                {match.homeTeam + " vs " + match.awayTeam}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.drinkBadge}>
                    <Ionicons
                      name="beer-outline"
                      size={15}
                      color={colors.white}
                    />
                    <Text style={styles.drinkCount}>
                      {player.drinksTaken || 0}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Final scores"
            icon="football-outline"
            color={colors.textSecondary}
            styles={styles}
          />
          {game.matches.length === 0 ? (
            <Text style={styles.empty}>No matches recorded</Text>
          ) : (
            game.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                isCommon={game.commonMatchId === match.id}
                style={styles.matchCard}
              />
            ))
          )}
        </View>
      </View>
    </>
  );
}

const StatItem: React.FC<{
  icon: "beer" | "football" | "people" | "trophy";
  label: string;
  value: number | string;
  color: string;
  styles: Pick<DetailStyles, "stat" | "statText" | "statValue" | "statLabel">;
}> = ({ icon, label, value, color, styles }) => (
  <View style={styles.stat}>
    <Ionicons name={icon} size={20} color={color} />
    <View style={styles.statText}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

const SectionHeader: React.FC<{
  title: string;
  icon: "people-outline" | "football-outline";
  color: string;
  styles: Pick<DetailStyles, "sectionHeader" | "sectionTitle">;
}> = ({ title, icon, color, styles }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon} size={19} color={color} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

interface DetailStyles {
  stat: ViewStyle;
  statText: ViewStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  sectionHeader: ViewStyle;
  sectionTitle: TextStyle;
}

export default GameDetailsModal;
