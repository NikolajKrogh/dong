import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
} from "react-native";
import { Match, Player } from "../../store/store";
import { Ionicons } from "@expo/vector-icons";

interface PlayersListProps {
  players: Player[];
  matches: Match[];
  commonMatchId: string;
  playerAssignments: Record<string, string[]>;
  handleDrinkIncrement: (playerId: string) => void;
  handleDrinkDecrement: (playerId: string) => void;
}

interface PlayerCardProps {
  player: Player;
  required: number;
  consumed: number;
  owed: number;
  percentComplete: number;
  handleDrinkIncrement: (playerId: string) => void;
  handleDrinkDecrement: (playerId: string) => void;
  animateValue: (anim: Animated.Value) => void;
}

// Create a separate component for each player card
const PlayerCard: React.FC<PlayerCardProps> = React.memo(
  ({
    player,
    required,
    consumed,
    owed,
    percentComplete,
    handleDrinkIncrement,
    handleDrinkDecrement,
    animateValue,
  }) => {
    // Animation refs
    const animValue = React.useRef(new Animated.Value(1)).current;
    const progressAnim = React.useRef(new Animated.Value(0)).current;
    const badgeAnim = React.useRef(new Animated.Value(1)).current;
    const prevOwedRef = React.useRef(owed);

    // Animate value change
    const handleValueAnimation = () => {
      animateValue(animValue);
    };

    // Update progress animation when percentComplete changes
    useEffect(() => {
      Animated.timing(progressAnim, {
        toValue: percentComplete,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }, [percentComplete]);

    // Animate badge when status changes
    useEffect(() => {
      if (
        prevOwedRef.current !== owed &&
        ((prevOwedRef.current > 0 && owed === 0) ||
          (prevOwedRef.current === 0 && owed > 0))
      ) {
        Animated.sequence([
          Animated.timing(badgeAnim, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(badgeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }

      prevOwedRef.current = owed;
    }, [owed]);

    return (
      <View style={styles.playerCard}>
        {/* Player name and completion status */}
        <View style={styles.cardHeader}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Animated.View
            style={[
              styles.statusBadge,
              owed === 0 ? styles.completedBadge : styles.pendingBadge,
              { transform: [{ scale: badgeAnim }] },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                owed === 0 ? styles.completedText : styles.pendingText,
              ]}
            >
              {owed === 0 ? "Completed" : `${owed.toFixed(1)} more`}
            </Text>
          </Animated.View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[
                styles.progressFill,
                owed === 0
                  ? styles.progressCompleted
                  : owed <= 0.5
                  ? styles.progressWarning
                  : styles.progressDanger,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </View>

        {/* Stats and controls */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{required.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Required</Text>
          </View>

          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, styles.decrementButton]}
              onPress={() => {
                handleDrinkDecrement(player.id);
                handleValueAnimation();
              }}
            >
              <Ionicons name="remove" size={18} color="#fff" />
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.valueContainer,
                { transform: [{ scale: animValue }] },
              ]}
            >
              <Text style={styles.controlValue}>{consumed.toFixed(1)}</Text>
              <Text style={styles.controlLabel}>Consumed</Text>
            </Animated.View>

            <TouchableOpacity
              style={[styles.controlButton, styles.incrementButton]}
              onPress={() => {
                handleDrinkIncrement(player.id);
                handleValueAnimation();
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

const PlayersList: React.FC<PlayersListProps> = ({
  players,
  matches,
  commonMatchId,
  playerAssignments,
  handleDrinkIncrement,
  handleDrinkDecrement,
}) => {
  // Function to animate a value change
  const animateValue = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * @brief Calculates the number of drinks required for a player based on assigned matches and goals scored.
   *
   * This function calculates the total number of drinks a player needs to take based on the goals scored in matches
   * they are assigned to. Goals from the common match are weighted more heavily than goals from other assigned matches.
   *
   * @param playerId The ID of the player for whom to calculate the drinks required.
   * @return The total number of drinks required for the player.
   */
  const calculateDrinksRequired = (playerId: string) => {
    let total = 0;

    const commonMatch = matches.find((m) => m.id === commonMatchId);
    if (commonMatch) {
      // Calculate total goals from home and away goals
      const commonMatchGoals =
        (commonMatch.homeGoals || 0) + (commonMatch.awayGoals || 0);
      total += commonMatchGoals * 1;
    }

    const assignedMatchIds = playerAssignments[playerId] || [];
    assignedMatchIds.forEach((matchId) => {
      // Skip the common match since we've already counted it
      if (matchId === commonMatchId) return;

      const match = matches.find((m) => m.id === matchId);
      if (match) {
        // Calculate total goals from home and away goals
        const matchGoals = (match.homeGoals || 0) + (match.awayGoals || 0);
        total += matchGoals * 0.5;
      }
    });

    return total;
  };

  const renderItem = ({ item }: { item: Player }) => {
    const required = calculateDrinksRequired(item.id);
    const consumed = item.drinksTaken || 0;
    const owed = Math.max(0, required - consumed);
    const percentComplete =
      required > 0 ? Math.min((consumed / required) * 100, 100) : 100;

    return (
      <PlayerCard
        player={item}
        required={required}
        consumed={consumed}
        owed={owed}
        percentComplete={percentComplete}
        handleDrinkIncrement={handleDrinkIncrement}
        handleDrinkDecrement={handleDrinkDecrement}
        animateValue={animateValue}
      />
    );
  };

  return (
    <FlatList
      data={players}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      contentContainerStyle={styles.listContainer}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  playerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  completedBadge: {
    backgroundColor: "#e8f5e9",
  },
  pendingBadge: {
    backgroundColor: "#ffebee",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  completedText: {
    color: "#2e7d32",
  },
  pendingText: {
    color: "#c62828",
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBackground: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressCompleted: {
    backgroundColor: "#4caf50",
  },
  progressWarning: {
    backgroundColor: "#ff9800",
  },
  progressDanger: {
    backgroundColor: "#f44336",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statBlock: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#424242",
  },
  statLabel: {
    fontSize: 12,
    color: "#757575",
    marginTop: 2,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  decrementButton: {
    backgroundColor: "#0275d8",
  },
  incrementButton: {
    backgroundColor: "#0275d8",
  },
  valueContainer: {
    alignItems: "center",
    marginHorizontal: 10,
    minWidth: 50,
  },
  controlValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#424242",
  },
  controlLabel: {
    fontSize: 12,
    color: "#757575",
    marginTop: 2,
  },
});

export default PlayersList;
