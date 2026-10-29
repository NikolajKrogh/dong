import React, { useEffect, useMemo } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { calculateDrinkBalance } from "./drinkBalance";

import AppIcon from "../../components/ui/AppIcon";
import { Match, Player } from "../../store/gameStore";
import { useColors } from "../../styles/theme";
import { createGameProgressStyles } from "./gameProgressStyles";

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
  /** Disable drink editing while multiplayer state is not editable. */
  disabled?: boolean;
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
  balanceLabel: string;
  /** Increment handler. */
  handleDrinkIncrement: (playerId: string) => void;
  /** Decrement handler. */
  handleDrinkDecrement: (playerId: string) => void;
  /** Whether the current viewport uses the wide layout branch. */
  isWideLayout: boolean;
  disabled: boolean;
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
    balanceLabel,
    handleDrinkIncrement,
    handleDrinkDecrement,
    isWideLayout,
    disabled,
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
      valueScale.set(withSequence(
        withTiming(1.2, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      ));
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
        badgeScale.set(withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1, { duration: 200 }),
        ));
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
      <View
        testID={`GameProgressPlayerCard-${player.id}`}
        style={[styles.playerCard, isWideLayout && styles.playerCardWide]}
      >
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
              {balanceLabel}
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
              testID={`DrinkDecrement-${player.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Decrease drinks consumed by ${player.name}`}
              style={[styles.controlButton, styles.actionButton]}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
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
              testID={`DrinkIncrement-${player.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Increase drinks consumed by ${player.name}`}
              style={[styles.controlButton, styles.actionButton]}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
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
  disabled = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createGameProgressStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1024;

  /**
   * FlatList item renderer for PlayerCard.
   * @param {{item: Player}} param0 Destructured object containing the player item.
   * @returns {JSX.Element} Rendered PlayerCard.
   */
  const renderItem = ({ item }: { item: Player }) => {
    const { required, consumed, remaining: owed, percentComplete, label } = calculateDrinkBalance(
      matches, commonMatchId, playerAssignments[item.id] ?? [], item.drinksTaken ?? 0,
    );

    return (
      <PlayerCard
        player={item}
        required={required}
        consumed={consumed}
        owed={owed}
        balanceLabel={label}
        percentComplete={percentComplete}
        handleDrinkIncrement={handleDrinkIncrement}
        handleDrinkDecrement={handleDrinkDecrement}
        isWideLayout={isWideLayout}
        disabled={disabled}
      />
    );
  };

  return (
    <FlatList
      testID="GameProgressPlayersList"
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
