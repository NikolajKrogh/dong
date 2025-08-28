import React, { useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { PlayerStat } from "./historyTypes";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import { Ionicons } from "@expo/vector-icons";
import PlayerDetailsModal from "./PlayerDetailsModal";
import PlayerComparisonModal from "./PlayerComparisonModal";
import { useGameStore } from "../../store/store";

/**
 * PlayerStatsListProps
 * @description Props for the PlayerStatsList component.
 * @property {PlayerStat[]} playerStats Player statistics to render.
 */
interface PlayerStatsListProps {
  playerStats: PlayerStat[];
}

/**
 * PlayerStatsList component.
 * @description Displays ranked player statistics (top 3 highlighted) including games, total drinks, and averages with a proportional bar.
 * @param {PlayerStatsListProps} props Component props.
 * @returns {React.ReactElement} Player stats list UI.
 */
const PlayerStatsList: React.FC<PlayerStatsListProps> = ({ playerStats }) => {
  const { history } = useGameStore();
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStat | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isComparisonModalVisible, setIsComparisonModalVisible] =
    useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerStat[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  /**
   * Handle player press.
   * @description Selects a player and opens the details modal.
   * @param {PlayerStat} player Selected player.
   */
  const handlePlayerPress = (player: PlayerStat) => {
    setSelectedPlayer(player);
    setIsModalVisible(true);
  };

  /**
   * Handle player selection for comparison.
   * @description Toggles/adds player to comparison selection, opening modal when two selected.
   * @param {PlayerStat} player Selected player.
   */
  const handlePlayerSelection = (player: PlayerStat) => {
    if (selectionMode) {
      if (selectedPlayers.find((p) => p.name === player.name)) {
        setSelectedPlayers(
          selectedPlayers.filter((p) => p.name !== player.name)
        );
      } else {
        const newSelectedPlayers = [...selectedPlayers, player];
        setSelectedPlayers(newSelectedPlayers);

        if (newSelectedPlayers.length === 2) {
          setIsComparisonModalVisible(true);
          setSelectionMode(false);
        }
      }
    } else {
      handlePlayerPress(player);
    }
  };

  /** Close player details modal. */
  const closeModal = () => {
    setIsModalVisible(false);
  };

  /**
   * Render a player statistic item.
   * @param {{item:PlayerStat,index:number}} param0 Destructured item + index.
   * @returns {JSX.Element} Player stat card.
   */
  const renderPlayerStatItem = ({
    item,
    index,
  }: {
    item: PlayerStat;
    index: number;
  }) => {
    const maxDrinks = Math.max(...playerStats.map((p) => p.totalDrinks));
    const widthPercentage =
      maxDrinks === 0 ? 0 : Math.max((item.totalDrinks / maxDrinks) * 100, 0);
    const isSelected = selectedPlayers.find((p) => p.name === item.name);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handlePlayerSelection(item)}
        style={[
          styles.enhancedPlayerCard,
          index === 0 ? styles.topPlayerCard : null,
          isSelected ? styles.selectedPlayerCard : null,
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

        {/* Drink visualization bar */}
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

  /** Toggle selection mode for comparison. */
  const toggleSelectionMode = () => {
    if (playerStats.length < 2) {
      Alert.alert(
        "Cannot Compare",
        "You need at least two players to use the comparison feature."
      );
      return;
    }

    if (selectionMode) {
      setSelectionMode(false);
      setSelectedPlayers([]);
    } else {
      setSelectionMode(true);
      setSelectedPlayers([]);
    }
  };

  /** Close comparison modal and reset selected players. */
  const closeComparisonModal = () => {
    setIsComparisonModalVisible(false);
    setSelectedPlayers([]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Player Rankings</Text>
        <View style={styles.sectionHeaderButtons}>
          <Text style={styles.sectionSubtitle}>Based on total drinks</Text>
          <TouchableOpacity
            style={styles.compareButton}
            onPress={toggleSelectionMode}
          >
            <Ionicons
              name={selectionMode ? "close-circle" : "git-compare"}
              size={18}
              color={selectionMode ? colors.error : colors.primary}
            />
            <Text
              style={[
                styles.compareButtonText,
                selectionMode && { color: colors.error },
              ]}
            >
              {selectionMode ? "Cancel" : "Compare"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add selection instructions if in selection mode */}
      {selectionMode && (
        <Text style={styles.selectionInstructions}>
          Select two players to compare ({selectedPlayers.length}/2)
        </Text>
      )}

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

      {/* Player Comparison Modal */}
      {selectedPlayers.length === 2 && (
        <PlayerComparisonModal
          visible={isComparisonModalVisible}
          onClose={closeComparisonModal}
          player1={selectedPlayers[0]}
          player2={selectedPlayers[1]}
          gameHistory={history}
        />
      )}
    </View>
  );
};

export default PlayerStatsList;
