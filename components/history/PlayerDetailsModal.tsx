import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerStat, GameSession } from "./historyTypes";
import { createHistoryStyles } from "../../styles/historyStyles";
import { useColors } from "../../styles/theme";
import { findPlayerByIdentityKey, formatModalDate } from "./historyUtils";

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
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1024;
  const styles = useMemo(
    () => createHistoryStyles(colors, { screenWidth: width, isWideLayout }),
    [colors, isWideLayout, width],
  );
  if (!player) return null;

  // Find all games this player participated in
  // Get per-game drink data for history
  const gameData = gameHistory
    .flatMap((game) => {
      const playerInGame = findPlayerByIdentityKey(game, player.identityKey);
      if (!playerInGame) return [];
      return {
        id: game.id,
        date: game.date,
        drinks: playerInGame.drinksTaken || 0,
      };
    })
    .sort((a, b) => {
      const aTimestamp = a.date ? new Date(a.date).getTime() : Number.NaN;
      const bTimestamp = b.date ? new Date(b.date).getTime() : Number.NaN;
      const aKnown = Number.isNaN(aTimestamp) === false;
      const bKnown = Number.isNaN(bTimestamp) === false;
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      if (aKnown && bKnown && aTimestamp !== bTimestamp) {
        return bTimestamp - aTimestamp;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalCenteredView}>
        <View style={[styles.modalView, isWideLayout && styles.modalViewWide]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Player Details</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close player details"
            >
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={[
              styles.listContent,
              isWideLayout && styles.listContentWide,
            ]}
          >
            {/* Player Name and Overview */}
            <View style={styles.playerDetailsHeader}>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${player.name} avatar`}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: colors.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "700" }}>
                  {getInitials(player.name)}
                </Text>
              </View>
              <Text style={styles.modalTitle}>{player.name}</Text>
              {player.contextLabel && (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 13,
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  {player.contextLabel}
                </Text>
              )}
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

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

export default PlayerDetailsModal;
