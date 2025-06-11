import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchItemProps } from "./types";
import { getTeamLogoWithFallback } from "../../../utils/teamLogos";
import styles, { colors } from "../../../app/style/gameProgressStyles"; // Ensure colors is imported if used directly

/**
 * @brief Renders a single match item in a list layout.
 * - Displays team logos, scores, match status (live time, FT, HT), and assigned player count.
 * - Highlights the common match.
 * - Allows opening quick actions via touch.
 * @param {MatchItemProps} props - The properties passed to the component.
 * @returns {React.ReactElement} The rendered list item component.
 */
const MatchListItem: React.FC<MatchItemProps> = ({
  match,
  commonMatchId,
  assignedPlayers,
  liveMatch,
  openQuickActions,
}) => {
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
   * @brief Creates a visual representation of players assigned to a match using badges.
   * @returns {React.ReactNode} A View component containing player badges and optional count indicator
   */
  const playerDisplayText = useMemo(() => {
    if (!assignedPlayers || assignedPlayers.length === 0) {
      return <Text style={styles.emptyPlayerCount}>0</Text>;
    }
    const firstNames = assignedPlayers.map((p) => p.name.split(" ")[0]);
    const MAX_CHARS = 20;
    let charCount = 0;
    let namesCount = 0;
    for (const name of firstNames) {
      if (charCount + name.length <= MAX_CHARS) {
        charCount += name.length;
        namesCount++;
      } else {
        break;
      }
    }
    const visiblePlayers = assignedPlayers.slice(0, namesCount);
    const remaining = assignedPlayers.length - namesCount;
    return (
      <View style={styles.playerBadgeContainer}>
        {visiblePlayers.map((player) => (
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
      style={[styles.gridItem, styles.matchListItemCard]}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.7}
    >
      {/* Common indicator */}
      {match.id === commonMatchId && (
        <View style={styles.commonMatchIndicator}>
          <Text style={styles.commonMatchIndicator_Text}>Common</Text>
        </View>
      )}

      <View style={styles.teamsContainer}>
        {/* Team logos with scores positioned horizontally */}
        <View style={styles.logosRow}>
          {/* Home team: Logo on LEFT */}
          <View style={styles.matchList_HomeLogoWrapper}>
            <Image
              source={getTeamLogoWithFallback(match.homeTeam)}
              style={styles.matchList_LogoImage} 
            />
          </View>

          <View
            style={[styles.scoresContainer, styles.matchList_ScoresWrapper]}
          >
            <Text style={[styles.gridScoreText, styles.matchList_ScoreText]}>
              {homeScore}
            </Text>
            {isFinishedOrHalfTime ? (
              <Text
                style={[styles.minutesPlayedText, styles.matchList_StatusText]}
              >
                {displayStatus}
              </Text>
            ) : isCurrentlyLive ? (
              <Text
                style={[styles.minutesPlayedText, styles.matchList_StatusText]}
              >
                {displayStatus}
              </Text>
            ) : (
              <Text style={[styles.vsText, styles.matchList_VSFallbackText]}>
                -
              </Text>
            )}
            <Text style={[styles.gridScoreText, styles.matchList_ScoreText]}>
              {awayScore}
            </Text>
          </View>

          {/* Away team: Logo on RIGHT */}
          <View style={styles.matchList_AwayLogoWrapper}>
            <Image
              source={getTeamLogoWithFallback(match.awayTeam)}
              style={styles.matchList_LogoImage}
            />
          </View>
        </View>

        {/* Stats row */}
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

export default React.memo(MatchListItem);
