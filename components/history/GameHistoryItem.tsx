import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GameSession } from "./historyTypes";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import {
  calculateTotalGoals,
  calculateTotalDrinks,
  findTopDrinker,
  formatHistoryDate,
} from "./historyUtils";
import MatchCard from "./MatchCard";

/**
 * Props for GameHistoryItem.
 * @description Supplies the game session row to summarise plus details press handler.
 * @property {GameSession} game Game session record.
 * @property {(game: GameSession) => void} onDetailsPress Press handler to open details modal.
 */
interface GameHistoryItemProps {
  game: GameSession;
  onDetailsPress: (game: GameSession) => void;
}

/**
 * Game history list row.
 * @description Displays snapshot stats (players, drinks, goals, matches) and highlights top drinker.
 * Invokes details handler when pressed.
 * @param {GameHistoryItemProps} props Component props.
 * @returns {React.ReactElement} List row element.
 */
const GameHistoryItem: React.FC<GameHistoryItemProps> = ({
  game,
  onDetailsPress,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
  // Local expand toggle for potential future detailed match list (currently unused in snippet).
  const [showMatches, setShowMatches] = useState(false);

  // Use utility functions for calculations
  // Total drinks consumed.
  const totalDrinks = calculateTotalDrinks(game.players);
  // Total goals scored.
  const totalGoals = calculateTotalGoals(game.matches);
  // Top drinker (nullable).
  const topDrinker = findTopDrinker(game.players);

  return (
    <TouchableOpacity
      style={styles.gameItem}
      onPress={() => onDetailsPress(game)}
      activeOpacity={0.7} // Add feedback on press
    >
      {/* Game Header: Icon and Date */}
      <View style={styles.gameHeader}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.primary}
          style={{ marginRight: styles.gameIcon.marginRight }}
        />
        <Text style={styles.gameDate}>{formatHistoryDate(game.date)}</Text>
      </View>

      {/* Game Summary Stats - Inlined */}
      <View style={styles.gameSummary}>
        {/* Players Stat */}
        <View style={styles.summaryItem}>
          <Ionicons
            name="people"
            size={20}
            color={colors.primary}
            style={styles.summaryIcon}
          />
          <Text style={styles.summaryValue}>
            {game.players.length.toString()}
          </Text>
          <Text style={styles.summaryLabel}>Players</Text>
        </View>

        {/* Drinks Stat */}
        <View style={styles.summaryItem}>
          <Ionicons
            name="beer"
            size={20}
            color={colors.primary}
            style={styles.summaryIcon}
          />
          <Text style={styles.summaryValue}>{totalDrinks.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Drinks</Text>
        </View>

        {/* Goals Stat */}
        <View style={styles.summaryItem}>
          <Ionicons
            name="football"
            size={20}
            color={colors.primary}
            style={styles.summaryIcon}
          />
          <Text style={styles.summaryValue}>{totalGoals.toString()}</Text>
          <Text style={styles.summaryLabel}>Goals</Text>
        </View>

        {/* Matches Stat */}
        <View style={styles.summaryItem}>
          <Ionicons
            name="trophy"
            size={20}
            color={colors.primary}
            style={styles.summaryIcon}
          />
          <Text style={styles.summaryValue}>
            {game.matches.length.toString()}
          </Text>
          <Text style={styles.summaryLabel}>Matches</Text>
        </View>
      </View>

      {/* Top Drinker Highlight */}
      {topDrinker && (
        <View style={styles.topDrinkerContainer}>
          <Ionicons name="flame" size={18} color={colors.warning} />
          <Text style={styles.topDrinkerText} numberOfLines={1}>
            {"Top Drinker: "}
            <Text style={styles.topDrinkerName}>{topDrinker.name}</Text>
            <Text> ({topDrinker.drinksTaken?.toFixed(1) ?? "0"})</Text>
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default GameHistoryItem;
