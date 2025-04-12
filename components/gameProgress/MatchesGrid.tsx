import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Match, Player } from "../../app/store";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import styles from "../../app/style/gameProgressStyles";
import { MatchWithScore } from "../../hooks/useLiveScores";

/**
 * @interface MatchesGridProps
 * @brief Defines the properties required by the MatchesGrid component.
 */
interface MatchesGridProps {
  /** @param matches Array of match objects from the game store. */
  matches: Match[];
  /** @param players Array of player objects from the game store. */
  players: Player[];
  /** @param commonMatchId The ID of the match designated as 'common'. */
  commonMatchId: string;
  /** @param playerAssignments Record mapping player IDs to an array of match IDs they are assigned to. */
  playerAssignments: Record<string, string[]>;
  /** @param openQuickActions Function to open the quick actions modal for a specific match. */
  openQuickActions: (matchId: string) => void;
  /** @param liveMatches Optional array of live match data with scores. */
  liveMatches?: MatchWithScore[];
  /** @param refreshControl Optional React element for pull-to-refresh functionality. */
  refreshControl?: React.ReactElement;
  /** @param onRefresh Function to call when a refresh is triggered. */
  onRefresh: () => void;
  /** @param refreshing Boolean indicating if a refresh is currently in progress. */
  refreshing: boolean;
  /** @param lastUpdated Date object indicating the last time live scores were updated. */
  lastUpdated: Date | null;
  /** @param isPolling Boolean indicating if live score polling is active. */
  isPolling: boolean;
}

/**
 * @component MatchesGrid
 * @brief Displays a list or grid of matches with scores, player assignments, and live status.
 * Allows toggling between list and grid layouts and provides refresh functionality.
 * @param {MatchesGridProps} props - The properties for the component.
 */
const MatchesGrid: React.FC<MatchesGridProps> = ({
  matches,
  players,
  commonMatchId,
  playerAssignments,
  openQuickActions,
  liveMatches = [],
  refreshControl,
  onRefresh,
  refreshing,
  lastUpdated,
  isPolling,
}) => {
  // State to track layout mode
  const [useGridLayout, setUseGridLayout] = useState(false);

  // Keep animation for refresh indicator
  const spinValue = React.useRef(new Animated.Value(0)).current;

  // Create rotation animation when refreshing state changes
  React.useEffect(() => {
    if (refreshing) {
      // Start rotation animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Stop animation
      spinValue.setValue(0);
    }
  }, [refreshing, spinValue]);

  // Create interpolated rotation value
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  /**
   * @brief Toggles the display mode between grid and list layouts.
   */
  const toggleLayoutMode = () => {
    setUseGridLayout(!useGridLayout);
  };

  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get("window").width;
  const numColumns = useGridLayout ? (screenWidth > 600 ? 3 : 2) : 1;

  /**
   * @brief Memoized sorted list of matches.
   * Sorts matches with the common match first, then alphabetically by home team name.
   */
  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      // First priority: common match always first
      if (a.id === commonMatchId) return -1;
      if (b.id === commonMatchId) return 1;

      // Second priority: alphabetical sort by homeTeam
      return a.homeTeam.localeCompare(b.homeTeam);
    });
  }, [matches, commonMatchId]);

  /**
   * @brief Retrieves live match information for a given match ID.
   * @param {string} matchId - The ID of the match to find live info for.
   * @returns {MatchWithScore | undefined} The live match data or undefined if not found.
   */
  const getLiveMatchInfo = (matchId: string): MatchWithScore | undefined => {
    return liveMatches.find((m) => m.id === matchId);
  };

  /**
   * @brief Renders a single match item in the grid layout.
   * Displays team logos, scores, live status (minutes played), and assigned player count.
   * @param {{ item: Match }} param0 - Object containing the match item to render.
   * @returns {React.ReactElement} The rendered grid item component.
   */
  const renderGridItem = ({ item }: { item: Match }) => {
    // Get all players assigned to this match
    const assignedPlayers = players.filter(
      (player) =>
        item.id === commonMatchId ||
        (playerAssignments[player.id] &&
          playerAssignments[player.id].includes(item.id))
    );

    const liveMatch = getLiveMatchInfo(item.id);
    // Determine the status string ('FT', 'HT', '45'', '?') from live data
    const displayStatus = liveMatch?.minutesPlayed || "?";
    // Check if the status indicates a finished or half-time state
    const isFinishedOrHalfTime =
      displayStatus === "FT" || displayStatus === "HT";
    // Check the live flag from the API data
    const isCurrentlyLive = liveMatch?.isLive || false;

    // Use live match data if available, otherwise use local state
    const homeScore = liveMatch ? liveMatch.homeScore : item.homeGoals || 0; // Prefer live score if available
    const awayScore = liveMatch ? liveMatch.awayScore : item.awayGoals || 0; // Prefer live score if available

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => openQuickActions(item.id)}
        activeOpacity={0.7}
      >
        {/* Common indicator */}
        {item.id === commonMatchId && <View style={styles.commonIndicator} />}

        <View style={styles.teamsContainer}>
          {/* Team logos with scores positioned horizontally */}
          <View style={styles.logosRow}>
            {/* Home team: Logo on LEFT */}
            <View style={styles.teamLogoContainer}>
              <Image
                source={getTeamLogoWithFallback(item.homeTeam)}
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
                source={getTeamLogoWithFallback(item.awayTeam)}
                style={styles.teamLogo}
                resizeMode="contain"
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

  /**
   * @brief Renders a single match item in the list layout (card view).
   * Displays team logos, names, scores, live status (minutes played), assigned player count, and names preview.
   * @param {{ item: Match }} param0 - Object containing the match item to render.
   * @returns {React.ReactElement} The rendered list item component.
   */
  const renderListItem = ({ item }: { item: Match }) => {
    // Get all players assigned to this match
    const assignedPlayers = players.filter(
      (player) =>
        item.id === commonMatchId ||
        (playerAssignments[player.id] &&
          playerAssignments[player.id].includes(item.id))
    );

    const liveMatch = getLiveMatchInfo(item.id);
    // Determine the status string ('FT', 'HT', '45'', '?') from live data
    const displayStatus = liveMatch?.minutesPlayed || "?";
    // Check if the status indicates a finished or half-time state
    const isFinishedOrHalfTime =
      displayStatus === "FT" || displayStatus === "HT";
    // Check the live flag from the API data
    const isCurrentlyLive = liveMatch?.isLive || false;

    // Use live match data if available, otherwise use local state
    const homeScore = liveMatch ? liveMatch.homeScore : item.homeGoals || 0; // Prefer live score if available
    const awayScore = liveMatch ? liveMatch.awayScore : item.awayGoals || 0; // Prefer live score if available

    return (
      <TouchableOpacity
        style={[
          styles.matchCardContainer,
          { flex: 1, margin: 6, marginBottom: 12 }, // Ensure consistent margin
        ]}
        onPress={() => openQuickActions(item.id)}
        activeOpacity={0.8}
      >
        {/* Header with teams and scores */}
        <View style={styles.matchHeaderSection}>
          {/* Home team: Logo, Name (in column) */}
          <View style={styles.matchTeamContainer}>
            <Image
              source={getTeamLogoWithFallback(item.homeTeam)}
              style={styles.matchTeamLogo}
            />
            <Text style={styles.matchTeamName} numberOfLines={1}>
              {item.homeTeam}
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
              source={getTeamLogoWithFallback(item.awayTeam)}
              style={styles.matchTeamLogo}
            />
            <Text style={styles.matchTeamName} numberOfLines={1}>
              {item.awayTeam}
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
        {item.id === commonMatchId && (
          <View style={styles.matchCommonBadge}>
            <Text style={styles.matchCommonBadgeText}>Common</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header with title, refresh status, and layout toggle */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>

        <View style={styles.headerButtons}>
          {/* Live status indicator and refresh button */}
          <View style={styles.headerStatus}>
            <View
              style={[
                styles.statusDot,
                isPolling ? styles.statusActive : styles.statusIdle,
              ]}
            />
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="refresh"
                  size={18}
                  color={refreshing ? "#adb5bd" : "#0275d8"}
                />
              </Animated.View>
              <Text style={styles.lastUpdateText}>
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) // Format time HH:MM
                  : "--:--"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Layout toggle button */}
          <TouchableOpacity
            style={styles.layoutToggleButton}
            onPress={toggleLayoutMode}
          >
            <Ionicons
              name={useGridLayout ? "list" : "grid"}
              size={22}
              color="#0275d8"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Match list/grid using FlatList */}
      <FlatList
        refreshControl={refreshControl} // Attach the refresh control passed via props
        key={`matches-${useGridLayout ? "grid" : "list"}-${numColumns}`} // Dynamic key to force re-render on layout change
        data={sortedMatches}
        keyExtractor={(item) => item.id}
        numColumns={useGridLayout ? numColumns : 1} // Set number of columns based on layout mode
        renderItem={useGridLayout ? renderGridItem : renderListItem} // Choose render function based on layout mode
        contentContainerStyle={styles.gridContainer} // Use same style for padding regardless of layout
        columnWrapperStyle={useGridLayout ? styles.gridRow : undefined} // Apply only for grid layout
      />
    </View>
  );
};

export default MatchesGrid;
