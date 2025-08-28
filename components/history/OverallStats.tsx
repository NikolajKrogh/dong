import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { GameSession } from "./historyTypes";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import { Ionicons } from "@expo/vector-icons";
import { calculateTotalGoals, calculateTotalDrinks } from "./historyUtils";

/**
 * OverallStatsProps
 * @description Props for the OverallStats component.
 * @property {GameSession[]} history Game session history array.
 */
interface OverallStatsProps {
  history: GameSession[];
}

/**
 * OverallStats component.
 * @description Displays aggregated statistics: total games, players (participations),
 * matches, goals, drinks, and average drinks per player.
 * @param {OverallStatsProps} props Component props.
 * @returns {React.ReactElement} Aggregated stats UI.
 */
const OverallStats: React.FC<OverallStatsProps> = ({ history }) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
  /** Total number of recorded game sessions. */
  const totalGames = history.length;

  /** Total player participations (not unique players). */
  const totalPlayers = history.reduce(
    (sum, game) => sum + game.players.length,
    0
  );

  /** Total matches across all sessions. */
  const totalMatches = history.reduce(
    (sum, game) => sum + game.matches.length,
    0
  );

  /** Total goals across all sessions (via calculateTotalGoals). */
  const totalGoals = calculateTotalGoals(
    history.flatMap((game) => game.matches)
  );

  /** Total drinks consumed across all sessions (via calculateTotalDrinks). */
  const totalDrinks = calculateTotalDrinks(
    history.flatMap((game) => game.players)
  );

  /** Average drinks per player participation (string formatted, '0' if none). */
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
            color={colors.white}
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
            <Ionicons name="game-controller" size={22} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalGames}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
        </View>

        {/* Total Players Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalPlayers}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
        </View>

        {/* Total Matches Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="trophy" size={22} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalMatches}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>

        {/* Total Goals Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View style={styles.statIconContainer}>
            <Ionicons name="football" size={22} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{totalGoals}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
        </View>

        {/* Average Drinks Per Player Stat Item */}
        <View style={styles.statItemWithIcon}>
          <View
            style={[
              styles.statIconContainer,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons name="flash" size={22} color={colors.primary} />
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
