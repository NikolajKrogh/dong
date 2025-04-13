import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GameSession } from "./historyTypes";
import { styles, colors } from "./historyStyles";
import {
  calculateTotalGoals,
  calculateTotalDrinks,
  findTopDrinker,
  formatHistoryDate,
} from "./historyUtils";
import StatDisplayItem from "./StatDisplayItem";
import MatchCard from "./MatchCard";

/**
 * @interface GameHistoryItemProps
 * @brief Props for the GameHistoryItem component.
 * @property {GameSession} game - The game session data to display.
 * @property {(game: GameSession) => void} onDetailsPress - Callback function invoked when the item is pressed, passing the game session data.
 */
interface GameHistoryItemProps {
  game: GameSession;
  onDetailsPress: (game: GameSession) => void;
}

/**
 * @component GameHistoryItem
 * @brief A component that displays a summary of a single game session in the history list.
 *
 * This component shows key information about a game session, including the date,
 * number of players, total drinks, total goals, and total matches. It also highlights
 * the top drinker for the session. Users can tap the item to view more details (via onDetailsPress)
 * or expand/collapse a list of matches played during the session.
 *
 * @param {GameHistoryItemProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered GameHistoryItem component.
 */
const GameHistoryItem: React.FC<GameHistoryItemProps> = ({
  game,
  onDetailsPress,
}) => {
  /**
   * @brief State variable to control the visibility of the matches list.
   */
  const [showMatches, setShowMatches] = useState(false);

  // Use utility functions for calculations
  /**
   * @brief Total drinks consumed in this game session.
   */
  const totalDrinks = calculateTotalDrinks(game.players);
  /**
   * @brief Total goals scored in this game session.
   */
  const totalGoals = calculateTotalGoals(game.matches);
  /**
   * @brief The player who consumed the most drinks in this session. Null if no players or drinks.
   */
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
          color={colors.secondary}
          style={{ marginRight: styles.gameIcon.marginRight }}
        />
        <Text style={styles.gameDate}>{formatHistoryDate(game.date)}</Text>
      </View>

      {/* Game Summary Stats using StatDisplayItem */}
      <View style={styles.gameSummary}>
        <StatDisplayItem
          iconName="people"
          value={game.players.length}
          label="Players"
        />
        <StatDisplayItem
          iconName="beer"
          value={totalDrinks.toFixed(1)}
          label="Drinks"
          iconColor={colors.primary}
        />
        <StatDisplayItem
          iconName="football"
          value={totalGoals}
          label="Goals"
        />
        <StatDisplayItem
          iconName="trophy"
          value={game.matches.length}
          label="Matches"
        />
      </View>

      {/* Top Drinker Highlight */}
      {topDrinker && (
        <View style={styles.topDrinkerContainer}>
          <Ionicons name="flame" size={18} color="#ff8c00" />
          <Text style={styles.topDrinkerText} numberOfLines={1}>
            Top Drinker:{" "}
            <Text style={styles.topDrinkerName}>{topDrinker.name}</Text> (
            {topDrinker.drinksTaken || 0})
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default GameHistoryItem;
