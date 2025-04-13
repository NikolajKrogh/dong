import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { PlayerStat } from "./historyTypes";
import { styles, colors } from "./historyStyles";
import { Ionicons } from "@expo/vector-icons";
import PlayerDetailsModal from "./PlayerDetailsModal";
import { useGameStore } from "../store"; // To access game history

/**
 * @interface PlayerStatsListProps
 * @brief Props for the PlayerStatsList component.
 * @property {PlayerStat[]} playerStats - An array of player statistics to display.
 */
interface PlayerStatsListProps {
  playerStats: PlayerStat[];
}

/**
 * @component PlayerStatsList
 * @brief A component that displays ranked player statistics.
 *
 * This component takes an array of player statistics and renders them as a list,
 * with special styling for the top three ranked players. Each player card shows
 * their name, number of games played, total drinks, and average drinks per game.
 * Drink values are visualized with a horizontal bar whose width is proportional
 * to the player's drinks relative to the top drinker.
 *
 * @param {PlayerStatsListProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered PlayerStatsList component.
 */
const PlayerStatsList: React.FC<PlayerStatsListProps> = ({ playerStats }) => {
  const { history } = useGameStore(); // Get game history
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStat | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  /**
   * @brief Handles player selection and opens the details modal.
   * @param player The selected player.
   */
  const handlePlayerPress = (player: PlayerStat) => {
    setSelectedPlayer(player);
    setIsModalVisible(true);
  };

  /**
   * @brief Closes the player details modal.
   */
  const closeModal = () => {
    setIsModalVisible(false);
  };

  /**
   * @brief Renders an individual player statistic item.
   * @param item The PlayerStat object to render.
   * @param index The index of the item in the list, used for ranking display.
   * @returns Rendered player stat card.
   */
  const renderPlayerStatItem = ({
    item,
    index,
  }: {
    item: PlayerStat;
    index: number;
  }) => {
    // Calculate percentage width for drink visualization
    const maxDrinks = Math.max(...playerStats.map((p) => p.totalDrinks));
    const widthPercentage = Math.max((item.totalDrinks / maxDrinks) * 100, 30); // At least 30% width

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handlePlayerPress(item)}
        style={[
          styles.enhancedPlayerCard,
          index === 0 ? styles.topPlayerCard : null,
        ]}
      >
        {/* Rank badge for top 3 players */}
        {index < 3 && (
          <View
            style={[
              styles.rankBadge,
              index === 0
                ? styles.goldBadge
                : index === 1
                ? styles.silverBadge
                : styles.bronzeBadge,
            ]}
          >
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
        )}

               {/* Player name and games count */}
        <View style={styles.playerHeader}>
          <View style={styles.playerNameContainer}>
            <Ionicons
              name="person"
              size={16}
              color={colors.secondary}
              style={styles.playerIcon}
            />
            <Text style={styles.playerStatName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        </View>
        
        {/* Drink visualization bar with improved labeling */}
        <View style={styles.drinkBarSection}>
          <View style={styles.drinkBarHeader}>
            <Ionicons name="beer" size={16} color={colors.primary} />
            <Text style={styles.drinkBarLabel}>Total Drinks</Text>
          </View>
          <View style={styles.drinkBarContainer}>
            <View style={styles.drinkBarBackground} />
            <View style={[styles.drinkBar, { width: `${widthPercentage}%` }]}>
              <Text style={styles.drinkBarText}>
                {item.totalDrinks.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Player Rankings</Text>
        <Text style={styles.sectionSubtitle}>Based on total drinks</Text>
      </View>

      <FlatList
        data={playerStats}
        keyExtractor={(item) => item.name}
        renderItem={renderPlayerStatItem}
        scrollEnabled={false}
        contentContainerStyle={styles.playerListContent}
      />

      {/* Player Details Modal */}
      <PlayerDetailsModal
        visible={isModalVisible}
        onClose={closeModal}
        player={selectedPlayer}
        gameHistory={history}
      />
    </View>
  );
};

export default PlayerStatsList;
