import React from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerStat, GameSession } from "./historyTypes";
import { styles, colors } from "./historyStyles";
import { formatModalDate } from "./historyUtils";

/**
 * @brief Props for the PlayerDetailsModal component.
 * @property {boolean} visible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal should be closed.
 * @property {PlayerStat | null} player - The player data to display details for, or null if no player is selected.
 * @property {GameSession[]} gameHistory - Complete game history for finding player's participation.
 */
interface PlayerDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  player: PlayerStat | null;
  gameHistory: GameSession[];
}

/**
 * @brief A modal component that displays detailed information about a specific player.
 *
 * Shows comprehensive player statistics and game history, including total drinks,
 * games played, average per game, and a chronological breakdown of games with
 * individual drink amounts.
 *
 * @param props - The component props.
 * @returns The rendered modal component, or null if no player is selected.
 */
const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({
  visible,
  onClose,
  player,
  gameHistory,
}) => {
  if (!player) return null;

  // Find all games this player participated in
  const playerGames = gameHistory.filter((game) =>
    game.players.some((p) => p.name === player.name)
  );

  // Get per-game drink data for history
  const gameData = playerGames
    .map((game) => {
      const playerInGame = game.players.find((p) => p.name === player.name);
      return {
        id: game.id,
        date: game.date,
        drinks: playerInGame?.drinksTaken || 0,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Latest first

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
            <Text style={styles.modalTitle}>Player Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.listContent}
          >
            {/* Player Name and Overview */}
            <View style={styles.playerDetailsHeader}>
              <Ionicons
                name="person-circle"
                size={60}
                color={colors.secondary}
              />
              <Text style={styles.playerDetailsName}>{player.name}</Text>
            </View>

            {/* Stats Summary */}
            <View style={styles.modalSummaryCard}>
              <View style={styles.modalStatGrid}>
                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="beer"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.modalStatValue}>
                    {player.totalDrinks.toFixed(1)}
                  </Text>
                  <Text style={styles.modalStatLabel}>Total Drinks</Text>
                </View>

                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="game-controller"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.modalStatValue}>
                    {player.gamesPlayed}
                  </Text>
                  <Text style={styles.modalStatLabel}>Games Played</Text>
                </View>

                <View style={styles.modalStatItem}>
                  <Ionicons
                    name="trending-up"
                    size={24}
                    color={colors.primary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.modalStatValue}>
                    {player.averagePerGame.toFixed(1)}
                  </Text>
                  <Text style={styles.modalStatLabel}>Avg. Drinks/Game</Text>
                </View>
              </View>
            </View>

            {/* Game History */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Ionicons
                  name="calendar"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={styles.modalSectionTitle}>Game History</Text>
              </View>

              {gameData.length > 0 ? (
                gameData.map((game, index) => (
                  <View key={game.id} style={styles.playerGameItem}>
                    <View style={styles.playerGameDate}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.textMuted}
                      />
                      <Text style={styles.playerGameDateText}>
                        {formatModalDate(game.date)}
                      </Text>
                    </View>
                    <View style={styles.playerGameDrinks}>
                      <Text style={styles.playerGameDrinksText}>
                        {game.drinks.toFixed(1)}
                      </Text>
                      <Ionicons
                        name="beer-outline"
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No game data available</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default PlayerDetailsModal;
