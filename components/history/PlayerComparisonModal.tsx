import React from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerStat, GameSession } from "./historyTypes";
import { styles, colors } from "../../app/style/historyStyles";
import { getPlayerHeadToHeadStats } from "./historyUtils";
import { Ionicons as IoniconsType } from "@expo/vector-icons/build/Icons";

interface PlayerComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  player1: PlayerStat | null;
  player2: PlayerStat | null;
  gameHistory: GameSession[];
}


interface ComparisonStatItemProps {
  label: string;
  value1: string | number;
  value2: string | number;
  icon: keyof typeof IoniconsType.glyphMap;
  tooltip?: string; 
}

const PlayerComparisonModal: React.FC<PlayerComparisonModalProps> = ({
  visible,
  onClose,
  player1,
  player2,
  gameHistory,
}) => {
  if (!player1 || !player2) return null;

  // Get head-to-head stats
  const stats = getPlayerHeadToHeadStats(
    gameHistory,
    player1.name,
    player2.name
  );

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
            <Text style={styles.modalTitle}>Player Comparison</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.listContent}
          >
            {/* Header with player names */}
            <View style={styles.comparisonHeader}>
              <View style={styles.comparisonHeaderItem}>
                <Ionicons
                  name="person-circle"
                  size={40}
                  color={colors.primary}
                />
                <Text style={styles.comparisonPlayerName}>{player1.name}</Text>
              </View>

              <View style={styles.comparisonVs}>
                <Text style={styles.comparisonVsText}>VS</Text>
              </View>

              <View style={styles.comparisonHeaderItem}>
                <Ionicons
                  name="person-circle"
                  size={40}
                  color={colors.secondary}
                />
                <Text style={styles.comparisonPlayerName}>{player2.name}</Text>
              </View>
            </View>

            {/* Basic Stats Comparison */}
            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonSectionTitle}>Basic Stats</Text>
              <View style={styles.comparisonStats}>
                {/* Games Played Comparison */}
                <ComparisonStatItem
                  label="Games Played"
                  value1={stats.player1.gamesPlayed}
                  value2={stats.player2.gamesPlayed}
                  icon="game-controller"
                />

                {/* Total Drinks Comparison */}
                <ComparisonStatItem
                  label="Total Drinks"
                  value1={stats.player1.totalDrinks.toFixed(1)}
                  value2={stats.player2.totalDrinks.toFixed(1)}
                  icon="beer"
                />

                {/* Average Per Game Comparison */}
                <ComparisonStatItem
                  label="Avg. Drinks/Game"
                  value1={stats.player1.averagePerGame.toFixed(1)}
                  value2={stats.player2.averagePerGame.toFixed(1)}
                  icon="stats-chart"
                />
              </View>
            </View>

            {/* Head-to-Head Record */}
            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonSectionTitle}>
                Head-to-Head Record
              </Text>
              <View style={styles.headToHeadRecord}>
                <View style={styles.recordItem}>
                  <Text style={styles.recordValue}>
                    {stats.gamesPlayedTogether}
                  </Text>
                  <Text style={styles.recordLabel}>Games Together</Text>
                </View>

                <View style={styles.recordItem}>
                  <Text style={[styles.recordValue, { color: colors.primary }]}>
                    {stats.player1WinsCount}
                  </Text>
                  <Text style={styles.recordLabel}>Wins</Text>
                </View>

                <View style={styles.recordItem}>
                  <Text style={styles.recordValue}>{stats.tiedGamesCount}</Text>
                  <Text style={styles.recordLabel}>Ties</Text>
                </View>

                <View style={styles.recordItem}>
                  <Text
                    style={[styles.recordValue, { color: colors.secondary }]}
                  >
                    {stats.player2WinsCount}
                  </Text>
                  <Text style={styles.recordLabel}>Wins</Text>
                </View>
              </View>
            </View>

            {/* Drinking Performance */}
            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonSectionTitle}>
                Drinking Performance
              </Text>
              <View style={styles.performanceStats}>
                <ComparisonStatItem
                  label="Max in a Game"
                  value1={stats.player1MaxInAGame.toFixed(1)}
                  value2={stats.player2MaxInAGame.toFixed(1)}
                  icon="flame"
                />

                <ComparisonStatItem
                  label="Efficiency"
                  value1={stats.player1Efficiency.toFixed(2)}
                  value2={stats.player2Efficiency.toFixed(2)}
                  icon="flash"
                  tooltip="Drinks per match"
                />

                <ComparisonStatItem
                  label="Top Drinker"
                  value1={`${stats.player1TopDrinkerCount}x`}
                  value2={`${stats.player2TopDrinkerCount}x`}
                  icon="trophy"
                />
              </View>
            </View>

            {/* Influence Section */}
            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonSectionTitle}>
                Drinking Influence
              </Text>
              <View style={styles.influenceStats}>
                <View style={styles.influenceItem}>
                  <Text style={styles.influenceLabel}>
                    {player1.name} drinks{" "}
                    {getInfluenceText(
                      stats.player1AvgWithPlayer2,
                      stats.player1AvgWithoutPlayer2
                    )}{" "}
                    when playing with {player2.name}
                  </Text>
                  <View style={styles.influenceValues}>
                    <Text style={styles.influenceValue}>
                      With: {stats.player1AvgWithPlayer2.toFixed(1)}
                    </Text>
                    <Text style={styles.influenceValue}>
                      Without: {stats.player1AvgWithoutPlayer2.toFixed(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.influenceItem}>
                  <Text style={styles.influenceLabel}>
                    {player2.name} drinks{" "}
                    {getInfluenceText(
                      stats.player2AvgWithPlayer1,
                      stats.player2AvgWithoutPlayer1
                    )}{" "}
                    when playing with {player1.name}
                  </Text>
                  <View style={styles.influenceValues}>
                    <Text style={styles.influenceValue}>
                      With: {stats.player2AvgWithPlayer1.toFixed(1)}
                    </Text>
                    <Text style={styles.influenceValue}>
                      Without: {stats.player2AvgWithoutPlayer1.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Timeline Chart would go here */}
            {/* This would require a charting library like react-native-chart-kit */}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Update the ComparisonStatItem component with proper typing
const ComparisonStatItem: React.FC<ComparisonStatItemProps> = ({
  label,
  value1,
  value2,
  icon,
  tooltip,
}) => (
  <View style={styles.comparisonStatItem}>
    <View style={styles.comparisonStatHeader}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.comparisonStatLabel}>{label}</Text>
      {tooltip && (
        <TouchableOpacity style={styles.tooltipIcon}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
    <View style={styles.comparisonValues}>
      <Text style={[styles.comparisonValue, { color: colors.primary }]}>
        {value1}
      </Text>
      <Text style={styles.comparisonDivider}>vs</Text>
      <Text style={[styles.comparisonValue, { color: colors.secondary }]}>
        {value2}
      </Text>
    </View>
  </View>
);

// Update the getInfluenceText function with proper typing
const getInfluenceText = (withAvg: number, withoutAvg: number): string => {
  if (withAvg === 0 || withoutAvg === 0) return "the same";

  const percentChange = ((withAvg - withoutAvg) / withoutAvg) * 100;

  if (percentChange > 20) return "significantly more";
  if (percentChange > 5) return "more";
  if (percentChange < -20) return "significantly less";
  if (percentChange < -5) return "less";
  return "about the same";
};

export default PlayerComparisonModal;
