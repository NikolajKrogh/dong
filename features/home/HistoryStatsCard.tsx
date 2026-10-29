import { Link } from "expo-router";
import React from "react";
import { Platform, Text, View } from "react-native";

import { ShellCard } from "../../components/ui";
import AppIcon from "../../components/ui/AppIcon";
import { useColors } from "../../styles/theme";
import type { TopDrinkerInfo } from "./homeStats";
import createStyles from "./homeStyles";

interface HistoryStatsCardProps {
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  historyLength: number;
  topDrinkerInfo: TopDrinkerInfo | null;
  totalDrinks: number;
}

export const HistoryStatsCard: React.FC<HistoryStatsCardProps> = ({
  colors,
  styles,
  historyLength,
  topDrinkerInfo,
  totalDrinks,
}) => {
  const accessibleName = `Game Stats, Games Played ${historyLength}${topDrinkerInfo ? `, Top Drinker ${topDrinkerInfo.name} (${topDrinkerInfo.drinks.toFixed(1)})` : ""}, Total Drinks ${totalDrinks.toFixed(1)}, view history`;
  const card = (
      <ShellCard
        elevated
        {...(Platform.OS !== "web" ? {
          accessibilityRole: "link" as const,
          accessibilityLabel: accessibleName,
          testID: "home-history-stats-card",
        } : {})}
        cursor="pointer"
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineStyle: "solid",
          outlineColor: "$primaryFocus",
          outlineOffset: 3,
        }}
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
  if (Platform.OS === "web") {
    return <Link href="/history" testID="home-history-stats-card" style={{ display: "flex", width: "100%", textDecorationLine: "none" }}>
      {card}
    </Link>;
  }
  return <Link href="/history" asChild>{card}</Link>;
};
