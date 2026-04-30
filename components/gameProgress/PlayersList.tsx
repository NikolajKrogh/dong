import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Match, Player } from "../../store/store";
import AppIcon from "../AppIcon";
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
  /** Whether the current viewport uses the wide layout branch. */
  isWideLayout: boolean;
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
    isWideLayout,
  }) => {
    const colors = useColors();
    const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
    const valueScale = useSharedValue(1);
    const progressPercent = useSharedValue(0);
    const badgeScale = useSharedValue(1);
    const prevOwedRef = React.useRef(owed);
    const valueScaleStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: valueScale.value }],
      };
    });
    const progressStyle = useAnimatedStyle(() => {
      return {
        width: `${progressPercent.value}%`,
      };
    });
    const badgeStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: badgeScale.value }],
      };
    });

    /** Trigger consumed value scale animation. */
    const handleValueAnimation = () => {
      valueScale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
    };

    // Update progress animation when percentComplete changes
    useEffect(() => {
      progressPercent.value = withTiming(percentComplete, { duration: 600 });
    }, [percentComplete, progressPercent]);

    // Animate badge when status changes (e.g., from owed to completed)
    useEffect(() => {
      if (
        prevOwedRef.current !== owed &&
        ((prevOwedRef.current > 0 && owed === 0) || // Was owing, now completed
          (prevOwedRef.current === 0 && owed > 0)) // Was completed, now owing
      ) {
        badgeScale.value = withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1, { duration: 200 }),
        );
      }
      prevOwedRef.current = owed; // Update the ref for the next comparison
    }, [owed, badgeScale]);

    let progressFillVariant = styles.progressDanger;
    if (owed === 0) {
      progressFillVariant = styles.progressCompleted;
    } else if (owed <= 1) {
      progressFillVariant = styles.progressWarning;
    }

    return (
      <View style={[styles.playerCard, isWideLayout && styles.playerCardWide]}>
        {/* Player name and completion status */}
        <View style={styles.cardHeader}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Animated.View
            style={[
              styles.statusBadge,
              owed === 0 ? styles.completedBadge : styles.pendingBadge,
              badgeStyle,
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
              style={[styles.progressFill, progressFillVariant, progressStyle]}
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
              <AppIcon name="remove" size={18} color={colors.textLight} />
            </TouchableOpacity>

            <Animated.View style={[styles.valueContainer, valueScaleStyle]}>
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
              <AppIcon name="add" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  },
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
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1024;

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
        isWideLayout={isWideLayout}
      />
    );
  };

  return (
    <FlatList
      data={players}
      keyExtractor={(item) => item.id}
      numColumns={isWideLayout ? 2 : 1}
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      columnWrapperStyle={isWideLayout ? styles.playersListRow : undefined}
      contentContainerStyle={[
        styles.listContainer,
        isWideLayout && styles.playersListContentWide,
      ]}
    />
  );
};

PlayerCard.displayName = "PlayerCard";

export default PlayersList;
