import React, { useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, FlatList, Animated } from "react-native";
import { Match, Player } from "../../store/store";
import { Ionicons } from "@expo/vector-icons";
import { createGameProgressStyles } from "../../app/style/gameProgressStyles";
import { useColors } from "../../app/style/theme";

/** Props for PlayersList. @interface */
interface PlayersListProps {
  /** Players array. */
  players: Player[];
  /** Matches array. */
  matches: Match[];
  /** Common match ID. */
  commonMatchId: string;
  /** Map playerId -> matchIds assigned. */
  playerAssignments: Record<string, string[]>;
  /** Increment drink handler. */
  handleDrinkIncrement: (playerId: string) => void;
  /** Decrement drink handler. */
  handleDrinkDecrement: (playerId: string) => void;
}

/** Props for PlayerCard. @interface */
interface PlayerCardProps {
  /** Player entity. */
  player: Player;
  /** Drinks required (computed). */
  required: number;
  /** Drinks consumed. */
  consumed: number;
  /** Remaining drinks owed. */
  owed: number;
  /** Completion percentage (0-100). */
  percentComplete: number;
  /** Increment handler. */
  handleDrinkIncrement: (playerId: string) => void;
  /** Decrement handler. */
  handleDrinkDecrement: (playerId: string) => void;
  /** Animates stat value change. */
  animateValue: (anim: Animated.Value) => void;
}

/**
 * Player card with progress, status badge, and increment/decrement controls.
 * Animated progress & badge respond to drink changes; memoized for perf.
 * @param {PlayerCardProps} props Component props.
 * @returns {JSX.Element} Rendered player card.
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
    const colors = useColors();
    const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
    // Animation refs
    const animValue = React.useRef(new Animated.Value(1)).current;
    const progressAnim = React.useRef(new Animated.Value(0)).current;
    const badgeAnim = React.useRef(new Animated.Value(1)).current;
    const prevOwedRef = React.useRef(owed);

    /** Trigger consumed value scale animation. */
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
 * Player list rendering computed drink requirements per player.
 * @param {PlayersListProps} props Component props.
 * @returns {JSX.Element} FlatList of player cards.
 */
const PlayersList: React.FC<PlayersListProps> = ({
  players,
  matches,
  commonMatchId,
  playerAssignments,
  handleDrinkIncrement,
  handleDrinkDecrement,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
  /**
   * Scale pulse animation for provided Animated.Value.
   * @param {Animated.Value} anim Animated value controlling scale.
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
   * Compute drinks required for a player (common = 1x, assigned = 0.5x).
   * @param {string} playerId Player identifier.
   * @returns {number} Total required drinks.
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
   * FlatList item renderer for PlayerCard.
   * @param {{item: Player}} param0 Destructured object containing the player item.
   * @returns {JSX.Element} Rendered PlayerCard.
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
