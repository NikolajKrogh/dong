import React from "react";
import { Text, View } from "react-native";

import AppIcon from "../AppIcon";
import { ShellCard } from "../ui";
import createStyles from "../../app/style/indexStyles";
import { useColors } from "../../app/style/theme";
import type { TopDrinkerInfo } from "../../utils/homeStats";

interface HistoryStatsCardProps {
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  historyLength: number;
  topDrinkerInfo: TopDrinkerInfo | null;
  totalDrinks: number;
  onPress: () => void;
}

export const HistoryStatsCard: React.FC<HistoryStatsCardProps> = ({
  colors,
  styles,
  historyLength,
  topDrinkerInfo,
  totalDrinks,
  onPress,
}) => {
  return (
    <ShellCard
      elevated
      onPress={onPress}
      testID="home-history-stats-card"
      style={{ marginTop: 16 }}
    >
      <View style={styles.statsHeader}>
        <View style={styles.titleWithIcon}>
          <Text style={styles.statsTitle}>Game Stats</Text>
          <AppIcon
            name="chevron-forward"
            size={18}
            color={colors.primary}
            style={styles.titleChevron}
          />
        </View>
      </View>

      <View style={styles.statsContent}>
        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <AppIcon name="calendar" size={20} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statLabel}>Games Played</Text>
            <Text style={styles.statValue}>{historyLength}</Text>
          </View>
        </View>

        {topDrinkerInfo && (
          <View style={styles.statItem}>
            <View style={styles.iconContainer}>
              <AppIcon name="trophy" size={20} color={colors.primary} />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={styles.statLabel}>Top Drinker</Text>
              <Text
                style={styles.statValue}
              >{`${topDrinkerInfo.name} (${topDrinkerInfo.drinks.toFixed(1)})`}</Text>
            </View>
          </View>
        )}

        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <AppIcon name="beer" size={20} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statLabel}>Total Drinks</Text>
            <Text style={styles.statValue}>{totalDrinks.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </ShellCard>
  );
};

export default HistoryStatsCard;
