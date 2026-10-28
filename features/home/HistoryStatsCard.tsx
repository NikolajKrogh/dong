import React from "react";
import { Platform, Text, View } from "react-native";
import { Link } from "expo-router";

import AppIcon from "../../components/AppIcon";
import { ShellCard } from "../../components/ui";
import createStyles from "./homeStyles";
import { useColors } from "../../styles/theme";
import type { TopDrinkerInfo } from "./homeStats";

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
  return (
    <Link href="/history" asChild>
      <ShellCard
        elevated
        {...(Platform.OS === "web"
          ? {
              render: <a href="/history" aria-label="Game Stats, view history" style={{ textDecoration: "none" }} />,
              role: "link",
              "aria-label": "Game Stats, view history",
            }
          : {
              accessibilityRole: "link",
              accessibilityLabel: "Game Stats, view history",
            })}
        cursor="pointer"
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineStyle: "solid",
          outlineColor: "$primaryFocus",
          outlineOffset: 3,
        }}
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
    </Link>
  );
};
