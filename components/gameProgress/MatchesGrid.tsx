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

interface MatchesGridProps {
  matches: Match[];
  players: Player[];
  commonMatchId: string;
  playerAssignments: Record<string, string[]>;
  openQuickActions: (matchId: string) => void;
  liveMatches?: MatchWithScore[];
  refreshControl?: React.ReactElement;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: Date | null;
  isPolling: boolean;
}

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

  // Toggle between grid and list layouts
  const toggleLayoutMode = () => {
    setUseGridLayout(!useGridLayout);
  };

  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get("window").width;
  const numColumns = useGridLayout ? (screenWidth > 600 ? 3 : 2) : 1;

  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      // First priority: common match always first
      if (a.id === commonMatchId) return -1;
      if (b.id === commonMatchId) return 1;

      // Second priority: alphabetical sort by homeTeam
      return a.homeTeam.localeCompare(b.homeTeam);
    });
  }, [matches, commonMatchId]);

  const getLiveMatchInfo = (matchId: string) => {
    // Only check for real live match data
    return liveMatches.find((m) => m.id === matchId);
  };

  // Render a compact match item for grid view
  const renderGridItem = ({ item }: { item: Match }) => {
    // Get all players assigned to this match
    const assignedPlayers = players.filter(
      (player) =>
        item.id === commonMatchId || // Either it's the common match (all players)
        (playerAssignments[player.id] &&
          playerAssignments[player.id].includes(item.id)) // Or specifically assigned
    );

    const liveMatch = getLiveMatchInfo(item.id);
    const isLive = liveMatch?.isLive || false;

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => openQuickActions(item.id)}
        activeOpacity={0.7}
      >
        {/* Common indicator - small green dot */}
        {item.id === commonMatchId && <View style={styles.commonIndicator} />}

        {/* Live indicator */}
        {isLive && (
          <View style={localStyles.gridLiveIndicator}>
            <Text style={localStyles.gridLiveText}>LIVE</Text>
          </View>
        )}

        <View style={styles.teamsContainer}>
          {/* Team logos with VS */}
          <View style={styles.logosRow}>
            <View style={styles.teamColumn}>
              <Image
                source={getTeamLogoWithFallback(item.homeTeam)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
              {isLive && (
                <Text style={localStyles.gridScoreText}>
                  {liveMatch?.homeScore}
                </Text>
              )}
            </View>

            <Text style={styles.vsText}>{isLive ? "-" : "vs"}</Text>

            <View style={styles.teamColumn}>
              <Image
                source={getTeamLogoWithFallback(item.awayTeam)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
              {isLive && (
                <Text style={localStyles.gridScoreText}>
                  {liveMatch?.awayScore}
                </Text>
              )}
            </View>
          </View>

          {/* Compact stats row */}
          <View style={styles.statsRow}>
            {!isLive ? (
              <View style={styles.statItem}>
                <Ionicons name="football-outline" size={14} color="#0275d8" />
                <Text style={styles.statValue}>{item.goals}</Text>
              </View>
            ) : null}

            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={13} color="#666" />
              <Text style={styles.statValue}>
                {assignedPlayers.length > 0
                  ? assignedPlayers.length === 1
                    ? assignedPlayers[0].name.split(" ")[0]
                    : `${assignedPlayers.length}`
                  : "0"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render a match item for the list view (original card)
  const renderListItem = ({ item }: { item: Match }) => {
    // Get all players assigned to this match
    const assignedPlayers = players.filter(
      (player) =>
        item.id === commonMatchId || // Either it's the common match (all players)
        (playerAssignments[player.id] &&
          playerAssignments[player.id].includes(item.id)) // Or specifically assigned
    );

    const liveMatch = getLiveMatchInfo(item.id);
    const isLive = liveMatch?.isLive || false;

    return (
      <TouchableOpacity
        style={[
          styles.matchCardContainer,
          {
            flex: 1,
            margin: 6,
            marginBottom: 12,
          },
        ]}
        onPress={() => openQuickActions(item.id)}
        activeOpacity={0.8}
      >
        {/* More compact layout with horizontal team display */}
        <View style={styles.matchHeaderSection}>
          {/* Home team */}
          <View style={styles.matchTeamContainer}>
            <Image
              source={getTeamLogoWithFallback(item.homeTeam)}
              style={styles.matchTeamLogo}
            />
            <Text style={styles.matchTeamName} numberOfLines={1}>
              {item.homeTeam}
            </Text>

            {/* Add score next to team name */}
            {isLive ? (
              <Text style={localStyles.scoreText}>{liveMatch?.homeScore}</Text>
            ) : null}
          </View>

          {/* VS badge */}
          <View style={styles.matchVsBadge}>
            <Text style={styles.matchVsText}>{isLive ? "-" : "VS"}</Text>
          </View>

          {/* Away team */}
          <View style={styles.matchTeamContainer}>
            {/* Add score next to team name */}
            {isLive ? (
              <Text style={localStyles.scoreText}>{liveMatch?.awayScore}</Text>
            ) : null}

            <Image
              source={getTeamLogoWithFallback(item.awayTeam)}
              style={styles.matchTeamLogo}
            />
            <Text style={styles.matchTeamName} numberOfLines={1}>
              {item.awayTeam}
            </Text>
          </View>
        </View>

        {/* Compact match details with ONLY players section when live */}
        <View style={styles.matchCompactDetails}>
          {/* Goals section - only show when not live */}
          {!isLive && (
            <>
              <View style={styles.matchCompactGoalsSection}>
                <Ionicons name="football" size={16} color="#0275d8" />
                <Text style={styles.matchGoalsCount}>{item.goals}</Text>
              </View>
              <View style={styles.matchDetailsDivider} />
            </>
          )}

          {/* Player section - simplified */}
          <View
            style={[
              styles.matchCompactPlayersSection,
              !isLive ? {} : { flex: 1 },
            ]}
          >
            <Text style={styles.matchPlayerCount}>
              <Ionicons name="people-outline" size={12} color="#666" />{" "}
              {assignedPlayers.length}
            </Text>

            {assignedPlayers.length > 0 && assignedPlayers.length <= 2 ? (
              <Text style={styles.matchPlayerPreview} numberOfLines={1}>
                {assignedPlayers.map((p) => p.name).join(", ")}
              </Text>
            ) : assignedPlayers.length > 2 ? (
              <Text style={styles.matchPlayerPreview} numberOfLines={1}>
                {assignedPlayers[0].name}, +{assignedPlayers.length - 1}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Common badge - moved to bottom right */}
        {item.id === commonMatchId && (
          <View style={styles.matchCommonBadge}>
            <Text style={styles.matchCommonBadgeText}>Common</Text>
          </View>
        )}

        {/* Live status indicator */}
        {isLive && (
          <View style={localStyles.liveIndicator}>
            <Text style={localStyles.liveText}>LIVE</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header with toggle button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>

        <View style={localStyles.headerButtons}>
          {/* Live status indicator */}
          <View style={updatedStyles.headerStatus}>
            <View
              style={[
                updatedStyles.statusDot,
                isPolling
                  ? updatedStyles.statusActive
                  : updatedStyles.statusIdle,
              ]}
            />
            <TouchableOpacity
              style={updatedStyles.refreshButton}
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
              <Text style={updatedStyles.lastUpdateText}>
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString().substr(0, 5)
                  : "--:--"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={localStyles.layoutToggleButton}
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

      {/* Match list/grid - Add refreshControl here */}
      <FlatList
        refreshControl={refreshControl}
        key={`matches-${useGridLayout ? "grid" : "list"}-${numColumns}`}
        data={sortedMatches}
        keyExtractor={(item) => item.id}
        numColumns={useGridLayout ? numColumns : 1}
        renderItem={useGridLayout ? renderGridItem : renderListItem}
        contentContainerStyle={
          useGridLayout ? styles.gridContainer : styles.gridContainer
        }
        columnWrapperStyle={useGridLayout ? styles.gridRow : undefined}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  liveIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#e74c3c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "column",
    alignItems: "center",
  },
  liveText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  layoutToggleButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "rgba(2, 117, 216, 0.08)",
  },
  // New styles for live scores
  scoreText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0275d8",
    marginHorizontal: 6,
  },
  gridLiveIndicator: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "#e74c3c",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  gridLiveText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
  },
  gridScoreText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0275d8",
    marginTop: 4,
  },
});

const updatedStyles = StyleSheet.create({
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: "#10b981",
  },
  statusIdle: {
    backgroundColor: "#adb5bd",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    backgroundColor: "rgba(2, 117, 216, 0.08)",
  },
  lastUpdateText: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "500",
    marginLeft: 4,
  },
});

export default MatchesGrid;
