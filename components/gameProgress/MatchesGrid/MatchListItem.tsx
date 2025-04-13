import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MatchItemProps } from "./types";
import { getTeamLogoWithFallback } from "../../../utils/teamLogos";
import styles from "../../../app/style/gameProgressStyles";

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

  return (
    <TouchableOpacity
      style={[
        styles.matchCardContainer,
        { flex: 1, margin: 6, marginBottom: 12 }, // Ensure consistent margin
      ]}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.8}
    >
      {/* Header with teams and scores */}
      <View style={styles.matchHeaderSection}>
        {/* Home team: Logo, Name (in column) */}
        <View style={styles.matchTeamContainer}>
          <Image
            source={getTeamLogoWithFallback(match.homeTeam)}
            style={styles.matchTeamLogo}
          />
          <Text style={styles.matchTeamName} numberOfLines={1}>
            {match.homeTeam}
          </Text>
        </View>

        {/* VS badge with scores on sides */}
        <View style={styles.scoreVsContainer}>
          <Text style={styles.scoreText}>{homeScore}</Text>

          {/* Show match status: FT/HT > Live Time > '-' Badge */}
          {isFinishedOrHalfTime ? (
            <View style={styles.listMinutesContainer}>
              <Text style={styles.minutesPlayedText}>{displayStatus}</Text>
            </View> // Show FT or HT
          ) : isCurrentlyLive ? (
            <View style={styles.listMinutesContainer}>
              <Text style={styles.minutesPlayedText}>{displayStatus}</Text>
            </View> // Show live minutes
          ) : (
            <View style={styles.matchVsBadge}>
              <Text style={styles.matchVsText}>-</Text>
            </View> // Fallback badge
          )}

          <Text style={styles.scoreText}>{awayScore}</Text>
        </View>

        {/* Away team: Logo, Name (in column) */}
        <View style={styles.matchTeamContainer}>
          <Image
            source={getTeamLogoWithFallback(match.awayTeam)}
            style={styles.matchTeamLogo}
          />
          <Text style={styles.matchTeamName} numberOfLines={1}>
            {match.awayTeam}
          </Text>
        </View>
      </View>

      {/* Player details section */}
      <View style={styles.matchCompactDetails}>
        <View style={styles.matchCompactPlayersSection}>
          <Text style={styles.matchPlayerCount}>
            <Ionicons name="people-outline" size={12} color="#666" />{" "}
            {assignedPlayers.length} Player
            {assignedPlayers.length !== 1 ? "s" : ""}
          </Text>

          {/* Show player names preview */}
          {assignedPlayers.length > 0 && assignedPlayers.length <= 2 ? (
            <Text style={styles.matchPlayerPreview} numberOfLines={1}>
              {assignedPlayers.map((p) => p.name).join(", ")}
            </Text>
          ) : assignedPlayers.length > 2 ? (
            <Text style={styles.matchPlayerPreview} numberOfLines={1}>
              {assignedPlayers[0].name}, +{assignedPlayers.length - 1} more
            </Text>
          ) : null}
        </View>
      </View>

      {/* Common badge */}
      {match.id === commonMatchId && (
        <View style={styles.matchCommonBadge}>
          <Text style={styles.matchCommonBadgeText}>Common</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(MatchListItem);
