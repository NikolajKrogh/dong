import React, { useMemo } from "react";
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

  /**
   * @brief Creates a visual representation of players assigned to a match using badges.
   *
   * This memoized function generates a component that displays player information with the following behavior:
   * - For empty assignments: Displays a "0" in muted styling
   * - For any number of players: Shows as many player badges as will fit within the MAX_CHARS limit
   * - Each badge displays the player's first name only
   * - When not all players can be shown, adds a "+N" counter badge for remaining players
   *
   * @returns {React.ReactNode} A View component containing player badges and optional count indicator
   */
  const playerDisplayText = useMemo(() => {
    if (!assignedPlayers || assignedPlayers.length === 0) {
      return <Text style={styles.emptyPlayerCount}>0</Text>;
    }
    // Show as many as reasonably fit with truncation

    // Calculate how many badges we can show based on character count
    const firstNames = assignedPlayers.map((p) => p.name.split(" ")[0]);
    const MAX_CHARS = 20;

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
      style={[styles.gridItem, { height: 120 }]}
      onPress={() => openQuickActions(match.id)}
      activeOpacity={0.7}
    >
      {/* Common indicator */}
      {match.id === commonMatchId && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            backgroundColor: "#4caf50",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderBottomLeftRadius: 6,
            borderTopRightRadius: 7,
            zIndex: 10,
          }}
        >
          <Text style={{ color: "white", fontSize: 7, fontWeight: "600" }}>
            Common
          </Text>
        </View>
      )}

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
            <Text style={[styles.gridScoreText, { fontSize: 26 }]}>
              {homeScore}
            </Text>
            {/* Show match status: FT/HT > Live Time > '-' */}
            {isFinishedOrHalfTime ? (
              <Text style={[styles.minutesPlayedText, { fontSize: 20 }]}>
                {displayStatus}
              </Text> // Show FT or HT
            ) : isCurrentlyLive ? (
              <Text style={[styles.minutesPlayedText, { fontSize: 20 }]}>
                {displayStatus}
              </Text> // Show live minutes
            ) : (
              <Text style={styles.vsText}>
                <Text style={{ fontSize: 20 }}>-</Text>
              </Text> // FallbackF
            )}

            <Text style={[styles.gridScoreText, { fontSize: 26 }]}>
              {awayScore}
            </Text>
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
            <Text style={styles.statValue}>{playerDisplayText}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(MatchListItem);
