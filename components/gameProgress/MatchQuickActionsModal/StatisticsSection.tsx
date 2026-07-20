import React from "react";
import { View } from "react-native";
import { MatchStatistics } from "../../../types/matchScores";
import { PossessionCircle } from "./PossessionCircle";
import { StatProgressBar } from "./StatProgressBar";
import { createStyles } from "./styles";

interface StatisticsSectionProps {
  homeStats: MatchStatistics;
  awayStats: MatchStatistics;
  styles: ReturnType<typeof createStyles>;
}

/** Possession doughnut + per-stat progress bars for the Statistics tab. */
export const StatisticsSection = ({
  homeStats,
  awayStats,
  styles,
}: StatisticsSectionProps) => {
  return (
    <View style={styles.statisticsContainer}>
      <PossessionCircle
        homeValue={homeStats.possession ?? 0}
        awayValue={awayStats.possession ?? 0}
      />

      <StatProgressBar
        homeValue={homeStats.shotsOnGoal ?? 0}
        awayValue={awayStats.shotsOnGoal ?? 0}
        label="Shots on Goal"
      />

      <StatProgressBar
        homeValue={homeStats.shotAttempts ?? 0}
        awayValue={awayStats.shotAttempts ?? 0}
        label="Shot Attempts"
      />

      <StatProgressBar
        homeValue={homeStats.fouls ?? 0}
        awayValue={awayStats.fouls ?? 0}
        label="Fouls"
      />

      <StatProgressBar
        homeValue={homeStats.yellowCards ?? 0}
        awayValue={awayStats.yellowCards ?? 0}
        label="Yellow Cards"
      />

      <StatProgressBar
        homeValue={homeStats.redCards ?? 0}
        awayValue={awayStats.redCards ?? 0}
        label="Red Cards"
      />

      <StatProgressBar
        homeValue={homeStats.cornerKicks ?? 0}
        awayValue={awayStats.cornerKicks ?? 0}
        label="Corner Kicks"
      />
    </View>
  );
};
