import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerStat, GameSession } from "./historyTypes";
import { useColors } from "../../styles/theme";
import { getPlayerHeadToHeadStats } from "./historyUtils";
import TooltipModal from "./TooltipModal";
import HistoryModalFrame from "./HistoryModalFrame";

interface PlayerComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  player1: PlayerStat | null;
  player2: PlayerStat | null;
  gameHistory: GameSession[];
}

const countLabel = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

const PlayerComparisonModal: React.FC<PlayerComparisonModalProps> = ({
  visible,
  onClose,
  player1,
  player2,
  gameHistory,
}) => {
  const colors = useColors();
  if (!player1 || !player2) return null;
  const stats = getPlayerHeadToHeadStats(gameHistory, player1, player2);
  const players = [player1, player2];
  return (
    <HistoryModalFrame
      visible={visible}
      onClose={onClose}
      title="Player Comparison"
      closeLabel="Close player comparison"
      testID="PlayerComparisonModal"
    >
      {({ contentWidth, fontScale, isDesktop }) => {
        const showBars = contentWidth >= 360 && fontScale < 1.5;
        const sectionStyle = [
          styles.section,
          {
            backgroundColor: colors.backgroundLight,
            borderColor: colors.border,
          },
        ];
        const titleStyle = [styles.sectionTitle, { color: colors.textPrimary }];
        return (
          <View style={styles.content}>
            <View style={styles.identityRow}>
              {players.map((player, index) => (
                <React.Fragment key={player.identityKey}>
                  {index === 1 && (
                    <Text style={{ color: colors.textMuted }}>vs</Text>
                  )}
                  <View style={styles.identity}>
                    <View
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={`${player.name} avatar`}
                      style={[
                        styles.avatar,
                        {
                          backgroundColor:
                            index === 0 ? colors.primary : colors.secondary,
                        },
                      ]}
                    >
                      <Text style={styles.initials}>
                        {initials(player.name)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.playerName, { color: colors.textPrimary }]}
                    >
                      {player.name}
                    </Text>
                    {player.contextLabel && (
                      <Text
                        style={[styles.context, { color: colors.textMuted }]}
                      >
                        {player.contextLabel}
                      </Text>
                    )}
                  </View>
                </React.Fragment>
              ))}
            </View>
            <View style={sectionStyle}>
              <Text style={titleStyle}>Basic statistics</Text>
              <ComparisonRow
                label="Games played"
                values={[stats.player1.gamesPlayed, stats.player2.gamesPlayed]}
                showBars={showBars}
              />
              <ComparisonRow
                label="Total drinks"
                values={[stats.player1.totalDrinks, stats.player2.totalDrinks]}
                decimals={1}
                showBars={showBars}
              />
              <ComparisonRow
                label="Average drinks per game"
                values={[
                  stats.player1.averagePerGame,
                  stats.player2.averagePerGame,
                ]}
                decimals={1}
                showBars={showBars}
                tooltip="Total drinks divided by the number of games that player participated in."
              />
            </View>
            <View
              style={[
                ...sectionStyle,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={titleStyle}>Shared games</Text>
              <Text
                style={[styles.sharedSummary, { color: colors.textSecondary }]}
              >
                {stats.gamesPlayedTogether
                  ? `${countLabel(stats.gamesPlayedTogether, "game")} together · ${countLabel(stats.tiedGamesCount, "tie")}`
                  : "No games together"}
              </Text>
              <ComparisonRow
                label="Higher drink total"
                values={[stats.player1WinsCount, stats.player2WinsCount]}
                showBars={showBars}
                tooltip="Number of shared games where this player's drink total was higher than the other player's. Equal totals count as ties."
              />
            </View>
            <View style={sectionStyle}>
              <Text style={titleStyle}>More statistics</Text>
              <ComparisonRow
                label="Most drinks in one game"
                values={[stats.player1MaxInAGame, stats.player2MaxInAGame]}
                decimals={1}
                showBars={showBars}
                tooltip="The highest drink total in any single game that player participated in, including games without the other player."
              />
              <ComparisonRow
                label="Drinks per match"
                values={[stats.player1Efficiency, stats.player2Efficiency]}
                decimals={2}
                showBars={showBars}
                tooltip="Total drinks divided by all stored matches in games that player participated in, including matches not assigned to them. When there are no stored matches, this value is zero."
              />
              <ComparisonRow
                label="Times top drinker"
                values={[
                  stats.player1TopDrinkerCount,
                  stats.player2TopDrinkerCount,
                ]}
                showBars={showBars}
                tooltip="Number of games where the player's drink total was the highest among all participants. Tied highest totals count for every tied player."
              />
            </View>
            <View style={sectionStyle}>
              <Text style={titleStyle}>With and without this player</Text>
              <Text
                style={[
                  styles.context,
                  { color: colors.textMuted, textAlign: "left" },
                ]}
              >
                Average drinks per game, grouped by whether the other player
                participated.
              </Text>
              <View
                style={[
                  styles.averageCards,
                  { flexDirection: isDesktop ? "row" : "column" },
                ]}
              >
                {players.map((player, index) => {
                  const gamesPlayed =
                    index === 0
                      ? stats.player1.gamesPlayed
                      : stats.player2.gamesPlayed;
                  const withAverage =
                    index === 0
                      ? stats.player1AvgWithPlayer2
                      : stats.player2AvgWithPlayer1;
                  const withoutAverage =
                    index === 0
                      ? stats.player1AvgWithoutPlayer2
                      : stats.player2AvgWithoutPlayer1;
                  const withoutCount = gamesPlayed - stats.gamesPlayedTogether;
                  return (
                    <View
                      key={player.identityKey}
                      testID={`comparison-averages-${index}`}
                      style={[
                        styles.averageCard,
                        { backgroundColor: colors.surface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.playerName,
                          { textAlign: "left", color: colors.textPrimary },
                        ]}
                      >
                        {player.name}
                      </Text>
                      <Text
                        style={[
                          styles.context,
                          { textAlign: "left", color: colors.textMuted },
                        ]}
                      >
                        With / without {players[1 - index].name}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>
                        With:{" "}
                        {stats.gamesPlayedTogether
                          ? `${withAverage.toFixed(1)} · ${countLabel(stats.gamesPlayedTogether, "game")}`
                          : "No games together"}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>
                        Without:{" "}
                        {withoutCount
                          ? `${withoutAverage.toFixed(1)} · ${countLabel(withoutCount, "game")}`
                          : "No other games"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );
      }}
    </HistoryModalFrame>
  );
};

function ComparisonRow({
  label,
  values,
  decimals = 0,
  showBars,
  tooltip,
}: {
  label: string;
  values: [number, number];
  decimals?: number;
  showBars: boolean;
  tooltip?: string;
}) {
  const colors = useColors();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const maximum = Math.max(...values);
  const renderValue = (index: 0 | 1) => (
    <View style={styles.valueColumn}>
      <Text
        testID={`${label}-value-${index}`}
        style={[
          styles.value,
          { color: index === 0 ? colors.primary : colors.textSecondary },
        ]}
      >
        {values[index].toFixed(decimals)}
      </Text>
      {showBars && (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[styles.track, { backgroundColor: colors.border }]}
        >
          <View
            testID={`${label}-bar-${index}`}
            style={{
              height: 4,
              borderRadius: 2,
              width: `${maximum > 0 ? (values[index] / maximum) * 100 : 0}%`,
              backgroundColor: index === 0 ? colors.primary : colors.secondary,
            }}
          />
        </View>
      )}
    </View>
  );
  return (
    <View style={[styles.metricRow, { borderColor: colors.border }]}>
      {renderValue(0)}
      <View style={styles.metricLabel}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        {tooltip && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`About ${label.toLowerCase()}`}
            onPress={() => setTooltipVisible(true)}
            style={styles.infoButton}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {renderValue(1)}
      {tooltip && (
        <TooltipModal
          visible={tooltipVisible}
          onClose={() => setTooltipVisible(false)}
          title={label}
          description={tooltip}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  identity: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  avatar: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  playerName: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  context: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  section: { borderWidth: 1, borderRadius: 16, padding: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  valueColumn: { flex: 1, minWidth: 0, gap: 8 },
  value: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  metricLabel: { flex: 1.4, minWidth: 0, alignItems: "center" },
  label: { fontSize: 13, textAlign: "center" },
  infoButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  sharedSummary: { fontSize: 14, marginBottom: 8 },
  averageCards: { gap: 12, marginTop: 12 },
  averageCard: { flex: 1, minWidth: 0, padding: 12, borderRadius: 12, gap: 8 },
});

export default PlayerComparisonModal;
