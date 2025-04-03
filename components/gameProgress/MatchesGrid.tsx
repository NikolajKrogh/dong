import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  StyleSheet,
} from "react-native";
import { Match, Player } from "../../app/store";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import styles from "../../app/style/gameProgressStyles";

interface MatchesGridProps {
  matches: Match[];
  players: Player[];
  commonMatchId: string;
  playerAssignments: Record<string, string[]>;
  openQuickActions: (matchId: string) => void;
}

const MatchesGrid: React.FC<MatchesGridProps> = ({
  matches,
  players,
  commonMatchId,
  playerAssignments,
  openQuickActions,
}) => {
  // State to track layout mode
  const [useGridLayout, setUseGridLayout] = useState(false);

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

  // Render a compact match item for grid view
  const renderGridItem = ({ item }: { item: Match }) => {
    // Get all players assigned to this match
    const assignedPlayers = players.filter(
      (player) =>
        item.id === commonMatchId || // Either it's the common match (all players)
        (playerAssignments[player.id] &&
          playerAssignments[player.id].includes(item.id)) // Or specifically assigned
    );

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => openQuickActions(item.id)}
        activeOpacity={0.7}
      >
        {/* Common indicator - small green dot */}
        {item.id === commonMatchId && (
          <View style={styles.commonIndicator} />
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
            </View>

            <Text style={styles.vsText}>vs</Text>

            <View style={styles.teamColumn}>
              <Image
                source={getTeamLogoWithFallback(item.awayTeam)}
                style={styles.teamLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Compact stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="football-outline" size={14} color="#0275d8" />
              <Text style={styles.statValue}>{item.goals}</Text>
            </View>
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
          </View>

          {/* VS badge */}
          <View style={styles.matchVsBadge}>
            <Text style={styles.matchVsText}>VS</Text>
          </View>

          {/* Away team */}
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

        {/* Compact match details with inline goals and players */}
        <View style={styles.matchCompactDetails}>
          {/* Goals section */}
          <View style={styles.matchCompactGoalsSection}>
            <Ionicons name="football" size={16} color="#0275d8" />
            <Text style={styles.matchGoalsCount}>{item.goals}</Text>
          </View>

          {/* Divider */}
          <View style={styles.matchDetailsDivider} />

          {/* Player section - simplified */}
          <View style={styles.matchCompactPlayersSection}>
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header with toggle button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <TouchableOpacity
          onPress={toggleLayoutMode}
          style={styles.toggleButton}
        >
          <Ionicons
            name={useGridLayout ? "list" : "grid"}
            size={22}
            color="#007bff"
          />
        </TouchableOpacity>
      </View>

      {/* Match list/grid */}
      <FlatList
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

export default MatchesGrid;