import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, Animated } from "react-native";
import { Match, Player } from "../../store/store";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../app/style/gameProgressStyles";
import { colors } from "../../app/style/palette"; 

/**
 * @interface PlayersListProps
 * @brief Props for the PlayersList component.
 */
interface PlayersListProps {
  /** @brief Array of player objects. */
  players: Player[];
  /** @brief Array of match objects. */
  matches: Match[];
  /** @brief ID of the common match. */
  commonMatchId: string;
  /** @brief Record of player assignments to matches. */
  playerAssignments: Record<string, string[]>;
  /** @brief Function to handle incrementing a player's drink count. */
  handleDrinkIncrement: (playerId: string) => void;
  /** @brief Function to handle decrementing a player's drink count. */
  handleDrinkDecrement: (playerId: string) => void;
}

/**
 * @interface PlayerCardProps
 * @brief Props for the PlayerCard component.
 */
interface PlayerCardProps {
  /** @brief The player object. */
  player: Player;
  /** @brief The number of drinks required for the player. */
  required: number;
  /** @brief The number of drinks consumed by the player. */
  consumed: number;
  /** @brief The number of drinks owed by the player. */
  owed: number;
  /** @brief The percentage of drinks completed by the player. */
  percentComplete: number;
  /** @brief Function to handle incrementing a player's drink count. */
  handleDrinkIncrement: (playerId: string) => void;
  /** @brief Function to handle decrementing a player's drink count. */
  handleDrinkDecrement: (playerId: string) => void;
  /** @brief Function to trigger an animation on value change. */
  animateValue: (anim: Animated.Value) => void;
}

/**
 * @brief A memoized component that displays a card for a single player.
 *
 * This component shows the player's name, their progress towards completing
 * their required drinks, and controls to increment or decrement their consumed drinks.
 * It also includes animations for value changes and status updates.
 *
 * @param {PlayerCardProps} props - The props for the component.
 * @returns {React.FC<PlayerCardProps>} A React functional component.
 */
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

    /**
     * @brief Triggers the animation for the consumed value.
     */
    const handleValueAnimation = () => {
      animateValue(animValue);
    };

    // Update progress animation when percentComplete changes
    useEffect(() => {
      Animated.timing(progressAnim, {
        toValue: percentComplete,
        duration: 600,
        useNativeDriver: false, // width animation not supported by native driver
      }).start();
    }, [percentComplete]);

    // Animate badge when status changes (e.g., from owed to completed)
    useEffect(() => {
      if (
        prevOwedRef.current !== owed &&
        ((prevOwedRef.current > 0 && owed === 0) || // Was owing, now completed
          (prevOwedRef.current === 0 && owed > 0)) // Was completed, now owing
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
      prevOwedRef.current = owed; // Update the ref for the next comparison
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
                  : owed <= 1
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
        <View style={styles.statsContainer}>
          <View style={styles.statBlock}>
            <Text style={styles.requiredValue}>{required.toFixed(1)}</Text>
            <Text style={styles.requiredLabel}>Required</Text>
          </View>

          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, styles.actionButton]}
              onPress={() => {
                handleDrinkDecrement(player.id);
                handleValueAnimation();
              }}
            >
              <Ionicons name="remove" size={18} color={colors.textLight} />
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
              style={[styles.controlButton, styles.actionButton]}
              onPress={() => {
                handleDrinkIncrement(player.id);
                handleValueAnimation();
              }}
            >
              <Ionicons name="add" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

/**
 * @brief A component that displays a list of player cards.
 *
 * This component takes a list of players and their match assignments,
 * calculates their required drinks, and renders a `PlayerCard` for each.
 * It uses a `FlatList` for efficient rendering of the list.
 *
 * @param {PlayersListProps} props - The props for the component.
 * @returns {React.FC<PlayersListProps>} A React functional component.
 */
const PlayersList: React.FC<PlayersListProps> = ({
  players,
  matches,
  commonMatchId,
  playerAssignments,
  handleDrinkIncrement,
  handleDrinkDecrement,
}) => {
  /**
   * @brief Animates a value with a sequence of scaling effects.
   * @param {Animated.Value} anim - The animated value to animate.
   */
  const animateValue = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1.2, // Scale up
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1, // Scale back to normal
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * @brief Calculates the number of drinks required for a player based on assigned matches and goals scored.
   *
   * This function calculates the total number of drinks a player needs to take based on the goals scored in matches
   * they are assigned to. Goals from the common match are weighted more heavily (1x) than goals from other assigned matches (0.5x).
   *
   * @param {string} playerId - The ID of the player for whom to calculate the drinks required.
   * @returns {number} The total number of drinks required for the player.
   */
  const calculateDrinksRequired = (playerId: string) => {
    let total = 0;

    // Calculate drinks from the common match
    const commonMatch = matches.find((m) => m.id === commonMatchId);
    if (commonMatch) {
      const commonMatchGoals =
        (commonMatch.homeGoals || 0) + (commonMatch.awayGoals || 0);
      total += commonMatchGoals * 1; // Weight for common match
    }

    // Calculate drinks from other assigned matches
    const assignedMatchIds = playerAssignments[playerId] || [];
    assignedMatchIds.forEach((matchId) => {
      // Skip the common match since we've already counted it
      if (matchId === commonMatchId) return;

      const match = matches.find((m) => m.id === matchId);
      if (match) {
        const matchGoals = (match.homeGoals || 0) + (match.awayGoals || 0);
        total += matchGoals * 0.5; // Weight for other assigned matches
      }
    });

    return total;
  };

  /**
   * @brief Renders a single player card item for the FlatList.
   * @param {object} item - The player object from the FlatList data.
   * @returns {JSX.Element} The PlayerCard component.
   */
  const renderItem = ({ item }: { item: Player }) => {
    const required = calculateDrinksRequired(item.id);
    const consumed = item.drinksTaken || 0;
    const owed = Math.max(0, required - consumed);
    const percentComplete =
      required > 0 ? Math.min((consumed / required) * 100, 100) : 100; // If required is 0, 100% complete

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

export default PlayersList;
