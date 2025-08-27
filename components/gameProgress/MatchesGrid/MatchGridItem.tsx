import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchItemProps } from "./types";
import { getTeamLogoWithFallback } from "../../../utils/teamLogos";
import { createGameProgressStyles } from "../../../app/style/gameProgressStyles";
import { useColors } from "../../../app/style/theme";

const MatchGridItem: React.FC<MatchItemProps> = ({
  match,
  commonMatchId,
  assignedPlayers,
  liveMatch,
  openQuickActions,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
  // Determine the status string ('FT', 'HT', '45'', '?') from live data
  const displayStatus = liveMatch?.minutesPlayed || "?";
  // Check if the status indicates a finished or half-time state
  const isFinishedOrHalfTime = displayStatus === "FT" || displayStatus === "HT";
  // Check the live flag from the API data
  const isCurrentlyLive = liveMatch?.isLive || false;

  // Use live match data if available, otherwise use local state
  const homeScore = liveMatch ? liveMatch.homeScore : match.homeGoals || 0;
  const awayScore = liveMatch ? liveMatch.awayScore : match.awayGoals || 0;

  /**
   * Build compact player badge list.
   * @description Memoized renderer that converts assigned players into a horizontal list of first‑name badges.
   * Shows: muted 0 when empty; as many badges as fit within a simple character budget; a +N overflow badge when
   * some players are hidden. Optimised for very small footprint in the grid card.
   * @returns {React.ReactNode} Badge container element.
   */
  const playerDisplayText = useMemo(() => {
    if (!assignedPlayers || assignedPlayers.length === 0) {
      return <Text style={styles.emptyPlayerCount}>0</Text>;
    }
    // Show as many as reasonably fit with truncation

    // Calculate how many badges we can show based on character count
    const firstNames = assignedPlayers.map((p) => p.name.split(" ")[0]);
    const MAX_CHARS = 6;

    let charCount = 0;
    let namesCount = 0;

    for (const name of firstNames) {
      // Approximate space needed for each badge
      if (charCount + name.length <= MAX_CHARS) {
        charCount += name.length;
        namesCount++;
      } else {
        break;
      }
    }

    // Show visible badges + count badge if needed
    const visiblePlayers = assignedPlayers.slice(0, namesCount);
    const remaining = assignedPlayers.length - namesCount;

    return (
      <View style={styles.playerBadgeContainer}>
        {visiblePlayers.map((player, index) => (
          <View key={player.id} style={styles.playerBadge}>
            <Text style={styles.playerBadgeText}>
              {player.name.split(" ")[0]}
            </Text>
          </View>
        ))}

        {remaining > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>+{remaining}</Text>
          </View>
        )}
      </View>
    );
  }, [assignedPlayers]);

  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.7}
    >
      {/* Common indicator */}
      {match.id === commonMatchId && <View style={styles.commonIndicator} />}

      <View style={styles.teamsContainer}>
        {/* Team logos with scores positioned horizontally */}
        <View style={styles.logosRow}>
          {/* Home team: Logo on LEFT */}
          <View style={styles.teamLogoContainer}>
            <Image
              source={getTeamLogoWithFallback(match.homeTeam)}
              style={styles.teamLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.scoresContainer}>
            <Text style={styles.gridScoreText}>{homeScore}</Text>

            {/* Show match status: FT/HT > Live Time > '-' */}
            {isFinishedOrHalfTime ? (
              <Text style={styles.minutesPlayedText}>{displayStatus}</Text> // Show FT or HT
            ) : isCurrentlyLive ? (
              <Text style={styles.minutesPlayedText}>{displayStatus}</Text> // Show live minutes
            ) : (
              <Text style={styles.vsText}>-</Text> // Fallback
            )}

            <Text style={styles.gridScoreText}>{awayScore}</Text>
          </View>

          {/* Away team: Logo on RIGHT */}
          <View style={styles.teamLogoContainer}>
            <Image
              source={getTeamLogoWithFallback(match.awayTeam)}
              style={styles.teamLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Stats row remains the same */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons
              name="people-outline"
              size={13}
              color={colors.textMuted}
            />
            <Text style={styles.statValue}>{playerDisplayText}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(MatchGridItem);
