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
  Modal,
} from "react-native";
import { Match, Player } from "../../app/store";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import styles from "../../app/style/gameProgressStyles";
import { MatchWithScore } from "../../hooks/useLiveScores";

// Define sorting options
type SortField = "homeTeam" | "awayTeam" | "playerName";
type SortDirection = "asc" | "desc";

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
  // State for sorting options
  const [sortField, setSortField] = useState<SortField>("homeTeam");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // State for sort options modal
  const [sortModalVisible, setSortModalVisible] = useState(false);

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

  /**
   * @brief Changes the sort field and toggles direction if same field is selected
   */
  const changeSortOption = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
    setSortModalVisible(false);
  };

  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get("window").width;
  const numColumns = useGridLayout ? (screenWidth > 600 ? 3 : 2) : 1;

  /**
   * @brief Gets the sorted list of players for a match
   * @param {Match} match - The match to get players for
   * @returns {Player[]} The sorted list of players assigned to the match
   */
  const getSortedPlayersForMatch = (match: Match): Player[] => {
    return players
      .filter(
        (player) =>
          match.id === commonMatchId ||
          (playerAssignments[player.id] &&
            playerAssignments[player.id].includes(match.id))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  /**
   * @brief Memoized sorted list of matches.
   * Sorts matches based on selected sort field and direction.
   */
  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      // Always prioritize common match first regardless of sort settings
      if (a.id === commonMatchId) return -1;
      if (b.id === commonMatchId) return 1;

      // Get player information for sorting by player name
      const playersA = getSortedPlayersForMatch(a);
      const playersB = getSortedPlayersForMatch(b);

      // Apply sorting based on selected field
      let comparison: number;

      if (sortField === "homeTeam") {
        comparison = a.homeTeam.localeCompare(b.homeTeam);
      } else if (sortField === "awayTeam") {
        comparison = a.awayTeam.localeCompare(b.awayTeam);
      } else {
        // playerName
        // Sort by first player name alphabetically or empty string if no players
        const firstPlayerNameA = playersA.length > 0 ? playersA[0].name : "";
        const firstPlayerNameB = playersB.length > 0 ? playersB[0].name : "";
        comparison = firstPlayerNameA.localeCompare(firstPlayerNameB);
      }

      // Apply sort direction
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    matches,
    commonMatchId,
    sortField,
    sortDirection,
    players,
    playerAssignments,
  ]);

  /**
   * @brief Retrieves live match information for a given match ID.
   * @param {string} matchId - The ID of the match to find live info for.
   * @returns {MatchWithScore | undefined} The live match data or undefined if not found.
   */
  const getLiveMatchInfo = (matchId: string): MatchWithScore | undefined => {
    return liveMatches.find((m) => m.id === matchId);
  };

  // Keeping the existing renderGridItem and renderListItem functions unchanged...
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

  /**
   * @brief Renders the sort options modal
   */
  const renderSortOptionsModal = () => (
    <Modal
      transparent={true}
      visible={sortModalVisible}
      animationType="fade"
      onRequestClose={() => setSortModalVisible(false)}
    >
      <TouchableOpacity
        style={sortStyles.modalOverlay}
        activeOpacity={1}
        onPress={() => setSortModalVisible(false)}
      >
        <View style={sortStyles.modalContent}>
          <Text style={sortStyles.modalTitle}>Sort Matches</Text>

          {/* Sort by Home Team option */}
          <TouchableOpacity
            style={sortStyles.sortOption}
            onPress={() => changeSortOption("homeTeam")}
          >
            <Text style={sortStyles.sortOptionText}>Home Team</Text>
            {sortField === "homeTeam" && (
              <Ionicons
                name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
                size={18}
                color="#0275d8"
              />
            )}
          </TouchableOpacity>

          {/* Sort by Away Team option */}
          <TouchableOpacity
            style={sortStyles.sortOption}
            onPress={() => changeSortOption("awayTeam")}
          >
            <Text style={sortStyles.sortOptionText}>Away Team</Text>
            {sortField === "awayTeam" && (
              <Ionicons
                name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
                size={18}
                color="#0275d8"
              />
            )}
          </TouchableOpacity>

          {/* Sort by Player Name option */}
          <TouchableOpacity
            style={sortStyles.sortOption}
            onPress={() => changeSortOption("playerName")}
          >
            <Text style={sortStyles.sortOptionText}>Player Name</Text>
            {sortField === "playerName" && (
              <Ionicons
                name={sortDirection === "asc" ? "arrow-up" : "arrow-down"}
                size={18}
                color="#0275d8"
              />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Define a footer component for the FlatList that can trigger refresh
  const ListFooter = () => (
    <View style={timestampStyles.footerContainer}>
      <TouchableOpacity
        style={[
          timestampStyles.pill,
          refreshing && timestampStyles.pillRefreshing,
        ]}
        onPress={onRefresh}
        activeOpacity={0.6}
        disabled={refreshing}
      >
        {refreshing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={14} color="#666" />
          </Animated.View>
        ) : (
          <Ionicons name="time-outline" size={14} color="#666" />
        )}

        <Text style={timestampStyles.timeText}>
          {refreshing
            ? "Refreshing..."
            : lastUpdated
            ? lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--"}
        </Text>
        {isPolling && !refreshing && <View style={timestampStyles.liveDot} />}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Header with title, refresh status, and layout toggle */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>

        <View style={styles.headerButtons}>
          {/* Sort button */}
          <TouchableOpacity
            style={sortStyles.sortButton}
            onPress={() => setSortModalVisible(true)}
          >
            <Ionicons name="funnel-outline" size={18} color="#0275d8" />
            <Ionicons
              name={
                sortDirection === "asc"
                  ? "arrow-up-outline"
                  : "arrow-down-outline"
              }
              size={14}
              color="#0275d8"
              style={{ marginLeft: 2 }}
            />
          </TouchableOpacity>


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

      {/* Sort options modal */}
      {renderSortOptionsModal()}

      {/* Match list container - makes content scrollable but keeps pill fixed */}
      <View style={{ flex: 1 }}>
        {/* Match list/grid using FlatList */}
        <FlatList
          refreshControl={refreshControl}
          key={`matches-${
            useGridLayout ? "grid" : "list"
          }-${numColumns}-${sortField}-${sortDirection}`}
          data={sortedMatches}
          keyExtractor={(item) => item.id}
          numColumns={useGridLayout ? numColumns : 1}
          renderItem={useGridLayout ? renderGridItem : renderListItem}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={useGridLayout ? styles.gridRow : undefined}
          ListFooterComponent={ListFooter} // Add the timestamp as footer component
        />
      </View>
    </View>
  );
};

// Additional styles for sorting UI
const sortStyles = StyleSheet.create({
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sortOptionText: {
    fontSize: 16,
  },
});

// Additional styles for the timestamp pill with fixed positioning
const timestampStyles = StyleSheet.create({
  footerContainer: {
    alignItems: "center",
    paddingVertical: 20,
    width: "100%",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pillRefreshing: {
    backgroundColor: "#f0f0f0",
    borderColor: "#e0e0e0",
    borderWidth: 1,
  },
  timeText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#28a745",
    marginLeft: 4,
  },
});

export default MatchesGrid;
