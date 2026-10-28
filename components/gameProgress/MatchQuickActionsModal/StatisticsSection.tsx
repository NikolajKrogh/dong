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
        homeValue={homeStats.possession}
        awayValue={awayStats.possession}
      />

      <StatProgressBar
        homeValue={homeStats.shotsOnGoal}
        awayValue={awayStats.shotsOnGoal}
        label="Shots on Goal"
      />

      <StatProgressBar
        homeValue={homeStats.shotAttempts}
        awayValue={awayStats.shotAttempts}
        label="Shot Attempts"
      />

      <StatProgressBar
        homeValue={homeStats.fouls}
        awayValue={awayStats.fouls}
        label="Fouls"
      />

      <StatProgressBar
        homeValue={homeStats.yellowCards}
        awayValue={awayStats.yellowCards}
        label="Yellow Cards"
      />

      <StatProgressBar
        homeValue={homeStats.redCards}
        awayValue={awayStats.redCards}
        label="Red Cards"
      />

      <StatProgressBar
        homeValue={homeStats.cornerKicks}
        awayValue={awayStats.cornerKicks}
        label="Corner Kicks"
      />
    </View>
  );
};
