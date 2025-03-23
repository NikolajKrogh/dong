import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import styles from "../../app/style/gameProgressStyles";
import { Match, Player } from "../../app/store";

interface PlayersListProps {
  players: Player[];
  matches: Match[];
  commonMatchId: string;
  playerAssignments: Record<string, string[]>;
  handleDrinkIncrement: (playerId: string) => void;
  handleDrinkDecrement: (playerId: string) => void;
}

const PlayersList: React.FC<PlayersListProps> = ({
  players,
  matches,
  commonMatchId,
  playerAssignments,
  handleDrinkIncrement,
  handleDrinkDecrement,
}) => {
  
  // Calculate drinks required for a player
  const calculateDrinksRequired = (playerId: string) => {
    let total = 0;
  
    const commonMatch = matches.find((m) => m.id === commonMatchId);
    if (commonMatch) {
      total += commonMatch.goals * 1;
    }
  
    const assignedMatchIds = playerAssignments[playerId] || [];
    assignedMatchIds.forEach((matchId) => {
      // Skip the common match since we've already counted it
      if (matchId === commonMatchId) return;
      
      const match = matches.find((m) => m.id === matchId);
      if (match) {
        total += match.goals * 0.5;
      }
    });
  
    return total;
  };

  return (
    <FlatList
      data={players}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={true}
      renderItem={({ item }) => {
        const required = calculateDrinksRequired(item.id);
        const consumed = item.drinksTaken || 0;
        const owed = Math.max(0, required - consumed);

        return (
          <View style={styles.playerCard}>
            {/* Header row with name and quick stats */}
            <View style={styles.playerCardHeader}>
              <Text style={styles.playerName}>{item.name}</Text>
              <View
                style={[
                  styles.quickStatBadge,
                  owed === 0 ? styles.owedZeroBadge : styles.owedPositiveBadge,
                ]}
              >
                <Text
                  style={[
                    styles.quickStatText,
                    owed === 0 ? styles.owedZeroText : styles.owedPositiveText,
                  ]}
                >
                  {owed > 0 ? `${owed.toFixed(1)} owed` : "✓ Done"}
                </Text>
              </View>
            </View>

            {/* Compact stats row with evenly distributed space */}
            <View style={styles.compactDrinkStats}>
              {/* Required */}
              <View style={styles.compactStatItem}>
                <Text style={styles.compactStatLabel}>Required</Text>
                <Text style={styles.compactStatValue}>
                  {required.toFixed(1)}
                </Text>
              </View>

              {/* Consumed with controls */}
              <View style={styles.compactStatWithControls}>
                <Text style={styles.compactStatLabel}>Consumed</Text>
                <View style={styles.compactControls}>
                  <TouchableOpacity
                    style={[styles.tinyButton, { backgroundColor: "#dc3545" }]}
                    onPress={() => handleDrinkDecrement(item.id)}
                  >
                    <Text style={styles.tinyButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.compactStatValue}>
                    {consumed.toFixed(1)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.tinyButton, { backgroundColor: "#28a745" }]}
                    onPress={() => handleDrinkIncrement(item.id)}
                  >
                    <Text style={styles.tinyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        );
      }}
      contentContainerStyle={styles.playersListContent}
    />
  );
};

export default PlayersList;
