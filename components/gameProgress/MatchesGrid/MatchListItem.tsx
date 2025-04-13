import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchItemProps } from "./types";
import { getTeamLogoWithFallback } from "../../../utils/teamLogos";
import styles from "../../../app/style/gameProgressStyles";

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

  const enhancedLogoStyle = {
    width: 45,
    height: 45,
    resizeMode: "contain" as "contain",
  };

  const enhancedLogoContainer = {
    width: 40,
    height: 50,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  };

  return (
    <TouchableOpacity
      style={[styles.gridItem, { height: 120 }]}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.7}
    >
      {/* Common indicator */}
      {match.id === commonMatchId && <View style={styles.commonIndicator} />}

      <View style={styles.teamsContainer}>
        {/* Team logos with scores positioned horizontally */}
        <View style={styles.logosRow}>
          {/* Home team: Logo on LEFT */}
          <View style={[enhancedLogoContainer, { paddingLeft: 45 }]}>
            <Image
              source={getTeamLogoWithFallback(match.homeTeam)}
              style={enhancedLogoStyle}
            />
          </View>

          <View style={[styles.scoresContainer, { paddingHorizontal: 6 }]}>
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
          <View style={[enhancedLogoContainer, { paddingRight: 45 }]}>
            <Image
              source={getTeamLogoWithFallback(match.awayTeam)}
              style={enhancedLogoStyle}
            />
          </View>
        </View>

        {/* Stats row remains the same */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={13} color="#666" />
            <Text style={styles.statValue}>
              {assignedPlayers.length > 0
                ? assignedPlayers.length === 1
                  ? assignedPlayers[0].name.split(" ")[0] // Show first name if only one player
                  : `${assignedPlayers.length}` // Show count if multiple players
                : "0"}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(MatchListItem);
