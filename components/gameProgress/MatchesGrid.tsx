import React from "react";
import { View, Text, TouchableOpacity, FlatList, Dimensions } from "react-native";
import styles from "../../app/style/gameProgressStyles";
import { Match, Player } from "../../app/store";

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
  openQuickActions
}) => {
  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get("window").width;
  const numColumns = screenWidth > 600 ? 3 : 1; // Use single column on mobile

  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      // First priority: common match always first
      if (a.id === commonMatchId) return -1;
      if (b.id === commonMatchId) return 1;
      
      // Second priority: alphabetical sort by homeTeam
      return a.homeTeam.localeCompare(b.homeTeam);
    });
  }, [matches, commonMatchId]);

  return (
    <FlatList
      key={`matches-grid-${numColumns}`}
      data={sortedMatches} // Use sorted matches instead of original matches
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      renderItem={({ item }) => {
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
              styles.matchGridItem,
              item.id === commonMatchId && styles.commonMatchGridItem,
            ]}
            onPress={() => openQuickActions(item.id)}
          >
            <View style={styles.matchCardContent}>
              {/* Left side: Match details */}
              <View style={styles.matchDetailsSection}>
                <Text style={styles.matchTeams}>
                  {item.homeTeam} vs {item.awayTeam}
                </Text>

                <View style={styles.goalBadge}>
                  <Text style={styles.goalBadgeText}>{item.goals}</Text>
                </View>
              </View>

              {/* Right side: Player names */}
              <View style={styles.playerNamesSection}>
                {assignedPlayers.length > 0 ? (
                  assignedPlayers.length <= 3 ? (
                    // Show all players if 3 or fewer
                    assignedPlayers.map((player) => (
                      <Text key={player.id} style={styles.assignedPlayerName}>
                        {player.name}
                      </Text>
                    ))
                  ) : (
                    // Show first 2 and a count if more than 3
                    <>
                      {assignedPlayers.slice(0, 2).map((player) => (
                        <Text
                          key={player.id}
                          style={styles.assignedPlayerName}
                        >
                          {player.name}
                        </Text>
                      ))}
                      <Text style={styles.assignedPlayerName}>
                        +{assignedPlayers.length - 2} more
                      </Text>
                    </>
                  )
                ) : (
                  <Text style={styles.noPlayersText}>
                    No players assigned
                  </Text>
                )}
              </View>
            </View>

            {/* Common badge */}
            {item.id === commonMatchId && (
              <View style={styles.commonBadge}>
                <Text style={styles.commonBadgeText}>Common</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={styles.matchesGridContainer}
    />
  );
};

export default MatchesGrid;