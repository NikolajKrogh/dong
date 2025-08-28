import React, { useMemo } from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerStat, GameSession } from "./historyTypes";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
import { getPlayerHeadToHeadStats } from "./historyUtils";
import TooltipModal from "./TooltipModal";

type IoniconName = keyof typeof Ionicons.glyphMap;

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
  icon: IoniconName;
  tooltip?: string;
}

/**
 * Player comparison modal.
 * @description Renders head‑to‑head stats, aggregate drinking performance and influence metrics
 * between two selected players. Hidden (returns null) if either player is missing.
 * @param {PlayerComparisonModalProps} props Component props (visibility, close handler, players, history).
 * @returns {React.ReactElement | null} Modal element or null.
 */
const PlayerComparisonModal: React.FC<PlayerComparisonModalProps> = ({
  visible,
  onClose,
  player1,
  player2,
  gameHistory,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
  if (!player1 || !player2) return null;

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
                  tooltip="Max in a Game"
                />

                <ComparisonStatItem
                  label="Per-Match Average"
                  value1={stats.player1Efficiency.toFixed(2)}
                  value2={stats.player2Efficiency.toFixed(2)}
                  icon="speedometer"
                  tooltip="Per-Match Average"
                />

                <ComparisonStatItem
                  label="Top Drinker"
                  value1={`${stats.player1TopDrinkerCount}x`}
                  value2={`${stats.player2TopDrinkerCount}x`}
                  icon="trophy"
                  tooltip="Top Drinker"
                />
              </View>
            </View>

            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonSectionTitle}>
                Drinking Influence
              </Text>
              <View style={styles.influenceStats}>
                <View style={styles.influenceItem}>
                  <Text style={styles.influenceLabel}>
                    <Text style={{ fontWeight: "bold" }}>{player1.name}</Text>{" "}
                    drinks{" "}
                    <Text
                      style={{
                        fontWeight: "bold",
                        color: getInfluenceColor(
                          colors,
                          stats.player1AvgWithPlayer2,
                          stats.player1AvgWithoutPlayer2
                        ),
                      }}
                    >
                      {getInfluenceText(
                        stats.player1AvgWithPlayer2,
                        stats.player1AvgWithoutPlayer2
                      )}
                    </Text>{" "}
                    when playing with {player2.name}
                  </Text>
                  <View style={styles.influenceValues}>
                    <Text style={styles.influenceValue}>
                      With:{" "}
                      <Text style={{ fontWeight: "bold" }}>
                        {stats.player1AvgWithPlayer2.toFixed(1)}
                      </Text>
                    </Text>
                    <Text style={styles.influenceValue}>
                      Without:{" "}
                      <Text style={{ fontWeight: "bold" }}>
                        {stats.player1AvgWithoutPlayer2.toFixed(1)}
                      </Text>
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Comparison stat row.
 * @description Shows a single labelled metric for both players with optional tooltip info.
 * @param {ComparisonStatItemProps} props Row props.
 * @returns {React.ReactElement} Stat row element.
 */
const ComparisonStatItem: React.FC<ComparisonStatItemProps> = ({
  label,
  value1,
  value2,
  icon,
  tooltip,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
  const [tooltipVisible, setTooltipVisible] = React.useState(false);

  /**
   * Derive tooltip copy from label.
   * @description Maps known labels to richer explanations; falls back to provided tooltip text.
   * @returns {{title: string; description: string}} Tooltip descriptor.
   */
  const getTooltipDetails = () => {
    switch (label) {
      case "Per-Match Average":
        return {
          title: "Per-Match Average",
          description:
            "This metric measures how many drinks each player consumes per match watched (not per game session). A higher value means the player drinks more per individual match they watch.",
        };
      case "Max in a Game":
        return {
          title: "Maximum Drinks in a Game",
          description:
            "This shows the highest number of drinks each player has consumed in a single game session. It highlights each player's peak drinking performance.",
        };
      case "Top Drinker":
        return {
          title: "Top Drinker Frequency",
          description:
            "This counts how many times each player ranked as the top drinker in a game session. It shows who tends to outdrink everyone else most often.",
        };
      default:
        return {
          title: label,
          description: tooltip || "No additional information available.",
        };
    }
  };

  const tooltipInfo = getTooltipDetails();

  return (
    <View style={styles.comparisonStatItem}>
      <View style={styles.comparisonStatHeader}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={styles.comparisonStatLabel}>{label}</Text>
        {tooltip && (
          <TouchableOpacity
            style={styles.tooltipIcon}
            onPress={() => setTooltipVisible(true)}
          >
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

      <TooltipModal
        visible={tooltipVisible}
        onClose={() => setTooltipVisible(false)}
        title={tooltipInfo.title}
        description={tooltipInfo.description}
      />
    </View>
  );
};

/**
 * Build influence delta text.
 * @description Returns qualitative phrase describing % change in drinks with vs without the other player.
 * @param {number} withAvg Average drinks when paired.
 * @param {number} withoutAvg Average drinks when not paired.
 * @returns {string} Human readable influence description.
 */
const getInfluenceText = (withAvg: number, withoutAvg: number): string => {
  if (withoutAvg === 0) {
    return withAvg === 0 ? "the same amount" : "exclusively";
  }

  const percentChange = ((withAvg - withoutAvg) / withoutAvg) * 100;
  const absChange = Math.abs(percentChange).toFixed(0);

  if (percentChange > 50) return `dramatically more (+${absChange}%)`;
  if (percentChange > 25) return `considerably more (+${absChange}%)`;
  if (percentChange > 10) return `notably more (+${absChange}%)`;
  if (percentChange > 5) return `slightly more (+${absChange}%)`;
  if (percentChange < -50) return `dramatically less (-${absChange}%)`;
  if (percentChange < -25) return `considerably less (-${absChange}%)`;
  if (percentChange < -10) return `notably less (-${absChange}%)`;
  if (percentChange < -5) return `slightly less (-${absChange}%)`;
  return "about the same amount";
};

/**
 * Influence color helper.
 * @description Chooses semantic color based on percentage change thresholds.
 * @param {ReturnType<typeof useColors>} colors Theme colors.
 * @param {number} withAvg Average with partner.
 * @param {number} withoutAvg Average without partner.
 * @returns {string} Hex/color token.
 */
const getInfluenceColor = (
  colors: ReturnType<typeof useColors>,
  withAvg: number,
  withoutAvg: number
): string => {
  if (withoutAvg === 0) return colors.textPrimary;

  const percentChange = ((withAvg - withoutAvg) / withoutAvg) * 100;

  if (percentChange > 10) return colors.primary;
  if (percentChange < -10) return colors.error;
  return colors.textPrimary;
};

export default PlayerComparisonModal;
