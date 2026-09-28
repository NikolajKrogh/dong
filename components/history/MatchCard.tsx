import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Match } from "./historyTypes";
import { useColors } from "../../styles/theme";
import HistoryTeamBadge from "./HistoryTeamBadge";

interface MatchCardProps {
  match: Match;
  isCommon?: boolean;
  /** Compact single-line team labels for small history previews. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Compact, non-interactive score card used in game history and details. */
const MatchCard: React.FC<MatchCardProps> = ({
  match,
  isCommon,
  compact = false,
  style,
}) => {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          minWidth: 0,
          padding: 10,
          borderRadius: 12,
          backgroundColor: colors.backgroundLight,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        },
        commonBadge: {
          alignSelf: "flex-start",
          marginBottom: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 10,
          backgroundColor: colors.primaryLight,
        },
        commonBadgeText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: "700",
        },
        teams: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minWidth: 0,
        },
        team: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
        },
        teamName: {
          width: "100%",
          marginTop: 4,
          color: colors.textSecondary,
          fontSize: compact ? 13 : 14,
          fontWeight: "600",
          textAlign: "center",
          lineHeight: compact ? 15 : 19,
        },
        score: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 52,
          marginHorizontal: 4,
        },
        scoreValue: {
          color: colors.textPrimary,
          fontSize: 15,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        },
        scoreDivider: {
          marginHorizontal: 5,
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: "600",
        },
      }),
    [colors, compact],
  );

  return (
    <View
      testID={`HistoryMatchCard-${match.id}`}
      style={[styles.card, isCommon && !compact && { backgroundColor: colors.primaryLight }, style]}
      accessible={false}
    >
      {isCommon && (
        <View style={styles.commonBadge}>
          <Text style={styles.commonBadgeText}>Common match</Text>
        </View>
      )}
      <View style={styles.teams}>
        <View style={styles.team}>
          <HistoryTeamBadge teamName={match.homeTeam} size={30} />
          <Text style={styles.teamName} numberOfLines={compact ? 1 : undefined}>
            {match.homeTeam}
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>{match.homeGoals ?? 0}</Text>
          <Text style={styles.scoreDivider}>–</Text>
          <Text style={styles.scoreValue}>{match.awayGoals ?? 0}</Text>
        </View>
        <View style={styles.team}>
          <HistoryTeamBadge teamName={match.awayTeam} size={30} />
          <Text style={styles.teamName} numberOfLines={compact ? 1 : undefined}>
            {match.awayTeam}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default MatchCard;
