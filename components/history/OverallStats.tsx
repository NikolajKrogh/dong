import React from "react";
import { View, Text } from "react-native";
import { GameSession } from "./historyTypes";
import { styles } from "../../app/style/historyStyles";
import { Ionicons } from "@expo/vector-icons";
import { calculateTotalGoals, calculateTotalDrinks } from "./historyUtils";

/**
 * @interface OverallStatsProps
 * @brief Props for the OverallStats component.
 * @property {GameSession[]} history - An array of game session objects containing historical game data.
 */
interface OverallStatsProps {
  history: GameSession[];
}

/**
 * @component OverallStats
 * @brief A React functional component that displays aggregated statistics from the game history.
 *
 * This component calculates and renders overall statistics such as total games played,
 * total players involved, total matches played, total goals scored, total drinks consumed,
 * and the average drinks per player across all recorded game sessions.
 * It features a prominent display for total drinks and a grid layout for other key stats.
 *
 * @param {OverallStatsProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered OverallStats component.
 */
const OverallStats: React.FC<OverallStatsProps> = ({ history }) => {
  /**
   * @brief Total number of game sessions recorded.
   */
  const totalGames = history.length;

  /**
   * @brief Total number of player participations across all games.
   * Note: This counts participation per game, not unique players.
   */
  const totalPlayers = history.reduce(
    (sum, game) => sum + game.players.length,
    0
  );

  /**
   * @brief Total number of matches played across all game sessions.
   */
  const totalMatches = history.reduce(
    (sum, game) => sum + game.matches.length,
    0
  );

  /**
   * @brief Total number of goals scored across all matches in all game sessions.
   * Uses the calculateTotalGoals utility function.
   */
  const totalGoals = calculateTotalGoals(
    history.flatMap((game) => game.matches)
  );

  /**
   * @brief Total number of drinks consumed across all players in all game sessions.
   * Uses the calculateTotalDrinks utility function.
   */
  const totalDrinks = calculateTotalDrinks(
    history.flatMap((game) => game.players)
  );

  /**
   * @brief Average number of drinks consumed per player participation.
   * Calculated as total drinks divided by total player participations.
   * Returns "0" if there are no player participations.
   */
  const averageDrinksPerPlayer =
    totalPlayers > 0 ? (totalDrinks / totalPlayers).toFixed(1) : "0";

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Overall Statistics</Text>

      {/* Featured Stat - Total Drinks */}
      <View style={styles.featuredStatCard}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons
            name="beer"
            size={32}
            color="#fff"
            style={{ marginRight: 12 }}
          />
          <View>
            <Text style={styles.featuredStatValue}>
              {totalDrinks.toFixed(1)}
            </Text>
            <Text style={styles.featuredStatLabel}>Total Drinks</Text>
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Total Games Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="game-controller" size={22} color="#0275d8" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalGames}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
        </View>

        {/* Total Players Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="people" size={22} color="#0275d8" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalPlayers}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
        </View>

        {/* Total Matches Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="trophy" size={22} color="#0275d8" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalMatches}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>

        {/* Total Goals Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="football" size={22} color="#0275d8" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalGoals}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
        </View>

        {/* Average Drinks Per Player Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#e3f2fd" }]}
          >
            <Ionicons name="flash" size={22} color="#0275d8" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{averageDrinksPerPlayer}</Text>
            <Text style={styles.statLabel}>Avg. Drinks/Player</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default OverallStats;
