import React from "react";
import { Text, View } from "react-native";
import { GoalScorer } from "../../../types/matchScores";
import { createStyles } from "./styles";

interface GoalScorersSectionProps {
  homeTeamScorers: GoalScorer[];
  awayTeamScorers: GoalScorer[];
  styles: ReturnType<typeof createStyles>;
}

/** Home/away goal scorer lists for API-controlled matches. */
export const GoalScorersSection = ({
  homeTeamScorers,
  awayTeamScorers,
  styles,
}: GoalScorersSectionProps) => {
  return (
    <View style={styles.goalScorersContainer}>
      {/* Home team scorers */}
      <View style={styles.teamScorersColumn}>
        {homeTeamScorers.length > 0 ? (
          <View style={styles.scorerContainer}>
            {homeTeamScorers.map((scorer) => (
              <Text
                key={`home-${scorer.name}-${scorer.time}-${scorer.teamId}`}
                style={styles.scorerText}
              >
                {scorer.name} {scorer.time}
                {scorer.isPenalty ? " (P)" : ""}
                {scorer.isOwnGoal ? " (OG)" : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* Away team scorers */}
      <View style={styles.teamScorersColumn}>
        {awayTeamScorers.length > 0 ? (
          <View style={styles.scorerContainer}>
            {awayTeamScorers.map((scorer) => (
              <Text
                key={`away-${scorer.name}-${scorer.time}-${scorer.teamId}`}
                style={styles.scorerText}
              >
                {scorer.name} {scorer.time}
                {scorer.isPenalty ? " (P)" : ""}
                {scorer.isOwnGoal ? " (OG)" : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
};
