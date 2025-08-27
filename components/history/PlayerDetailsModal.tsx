import React, { useMemo } from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerStat, GameSession } from "./historyTypes";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import { formatModalDate } from "./historyUtils";

/**
 * Player details modal.
 * @description Presents comprehensive stats (games, averages) and per‑game history for a single player.
 * Returns null if no player provided.
 * @param {PlayerDetailsModalProps} props Component props.
 * @returns {React.ReactElement | null} Modal element or null.
 */
interface PlayerDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  player: PlayerStat | null;
  gameHistory: GameSession[];
}

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({
  visible,
  onClose,
  player,
  gameHistory,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
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
              <Text style={styles.modalTitle}>{player.name}</Text>
            </View>

            <View style={styles.modalStatGrid}>
              <View style={styles.modalStatItem}>
                <Ionicons
                  name="game-controller"
                  size={24}
                  color={colors.primary}
                  style={styles.summaryIcon}
                />
                <Text style={styles.modalStatValue}>{player.gamesPlayed}</Text>
                <Text style={styles.modalStatLabel}>Games Played</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Ionicons
                  name="flash"
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
