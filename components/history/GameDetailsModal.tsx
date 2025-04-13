import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GameSession } from "./historyTypes";
import { styles, colors } from "../../app/style/historyStyles";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import {
  formatModalDate,
  calculateTotalGoals,
  calculateTotalDrinks,
} from "./historyUtils";

/**
 * @interface GameDetailsModalProps
 * @brief Props for the GameDetailsModal component.
 * @property {boolean} visible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal should be closed.
 * @property {GameSession | null} game - The game session data to display details for, or null if no game is selected.
 */
interface GameDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  game: GameSession | null;
}

/**
 * @component GameDetailsModal
 * @brief A modal component that displays detailed information about a specific game session.
 *
 * This modal shows summary statistics (total drinks, goals, players, matches),
 * a list of players with their drink counts, and a list of matches played during the session
 * with their scores and team logos.
 *
 * @param {GameDetailsModalProps} props - The props for the component.
 * @returns {React.ReactElement | null} The rendered modal component, or null if the game prop is null.
 */
const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  visible,
  onClose,
  game,
}) => {
  // If no game data is provided, don't render the modal.
  if (!game) return null;

  /**
   * @brief Total goals scored in the selected game session.
   */
  const totalGoals = calculateTotalGoals(game.matches);
  /**
   * @brief Total drinks consumed in the selected game session.
   */
  const totalDrinks = calculateTotalDrinks(game.players);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalCenteredView}>
        <View style={styles.modalView}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Game Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.listContent}
          >
            {/* Date Display */}
            <Text style={styles.modalDate}>{formatModalDate(game.date)}</Text>

            {/* Summary Statistics Section */}
            <View style={styles.modalSummaryCard}>
              <View style={styles.modalStatGrid}>
                {/* Total Drinks Stat */}
                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="beer"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.statValue}>{totalDrinks.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Total Drinks</Text>
                </View>
                {/* Total Goals Stat */}
                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="football"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.statValue}>{totalGoals}</Text>
                  <Text style={styles.statLabel}>Total Goals</Text>
                </View>
                {/* Total Players Stat */}
                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="people"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.statValue}>{game.players.length}</Text>
                  <Text style={styles.statLabel}>Players</Text>
                </View>
                {/* Total Matches Stat */}
                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="trophy"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.statValue}>{game.matches.length}</Text>
                  <Text style={styles.statLabel}>Matches</Text>
                </View>
              </View>
            </View>

            {/* Players List Section */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Ionicons name="list" size={20} color={colors.textSecondary} />
                <Text style={styles.modalSectionTitle}>Players</Text>
              </View>
              {/* Sort players by drinks taken (descending) and map to display */}
              {game.players
                .sort((a, b) => (b.drinksTaken || 0) - (a.drinksTaken || 0))
                .map((player, index) => (
                  <View key={index} style={styles.modalPlayerCard}>
                    {/* Player Info (Icon and Name) */}
                    <View style={styles.modalPlayerInfo}>
                      <Ionicons
                        name="person-circle-outline"
                        size={24}
                        color={colors.secondary}
                        style={{
                          marginRight: styles.modalPlayerIcon.marginRight,
                        }}
                      />
                      <Text style={styles.modalPlayerName}>{player.name}</Text>
                    </View>
                    {/* Player Drink Count Badge */}
                    <View style={styles.modalDrinkBadge}>
                      <Ionicons
                        name="beer-outline"
                        size={16}
                        color={colors.white}
                      />
                      <Text style={styles.modalPlayerDrinks}>
                        {player.drinksTaken || 0}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>

            {/* Matches List Section */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Ionicons
                  name="football-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={styles.modalSectionTitle}>Matches</Text>
              </View>
              {/* Map through matches to display scorecards */}
              {game.matches.map((match, index) => (
                <View key={index} style={styles.modalMatchCard}>
                  {/* Match Teams and Score Display */}
                  <View style={styles.matchTeams}>
                    {/* Home Team */}
                    <View style={styles.matchTeamBlock}>
                      <Image
                        source={getTeamLogoWithFallback(match.homeTeam)}
                        style={styles.modalMatchLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.modalMatchTeamName} numberOfLines={1}>
                        {match.homeTeam}
                      </Text>
                    </View>
                    {/* Score */}
                    <View style={styles.scoreBlock}>
                      <Text style={styles.modalScoreText}>
                        {match.homeGoals ?? 0}
                      </Text>
                      <Text style={styles.modalScoreDivider}>-</Text>
                      <Text style={styles.modalScoreText}>
                        {match.awayGoals ?? 0}
                      </Text>
                    </View>
                    {/* Away Team */}
                    <View style={styles.matchTeamBlock}>
                      <Image
                        source={getTeamLogoWithFallback(match.awayTeam)}
                        style={styles.modalMatchLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.modalMatchTeamName} numberOfLines={1}>
                        {match.awayTeam}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default GameDetailsModal;