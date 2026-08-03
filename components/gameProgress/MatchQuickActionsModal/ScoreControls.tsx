import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../../styles/theme";
import { createStyles } from "./styles";

interface ScoreControlsProps {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  isApiControlledMatch: boolean;
  liveHomeScore: number;
  liveAwayScore: number;
  goalValueAnimHome: Animated.Value;
  goalValueAnimAway: Animated.Value;
  incrementAnimHome: Animated.Value;
  decrementAnimHome: Animated.Value;
  incrementAnimAway: Animated.Value;
  decrementAnimAway: Animated.Value;
  animateButtonPress: (buttonAnim: Animated.Value) => void;
  handleGoalIncrement: (matchId: string, team: "home" | "away") => void;
  handleGoalDecrement: (matchId: string, team: "home" | "away") => void;
  styles: ReturnType<typeof createStyles>;
}

/**
 * Score display for the Overview tab: read-only for API-controlled matches,
 * or editable increment/decrement controls for manually-tracked matches.
 */
export const ScoreControls = ({
  matchId,
  homeGoals,
  awayGoals,
  isApiControlledMatch,
  liveHomeScore,
  liveAwayScore,
  goalValueAnimHome,
  goalValueAnimAway,
  incrementAnimHome,
  decrementAnimHome,
  incrementAnimAway,
  decrementAnimAway,
  animateButtonPress,
  handleGoalIncrement,
  handleGoalDecrement,
  styles,
}: ScoreControlsProps) => {
  const colors = useColors();

  if (isApiControlledMatch) {
    // Read-only score display for API matches
    return (
      <View style={styles.scoreContainer}>
        {/* Home team score */}
        <Animated.View
          style={[styles.scoreValue, { transform: [{ scale: goalValueAnimHome }] }]}
        >
          <Text style={styles.scoreText}>{liveHomeScore ?? 0}</Text>
        </Animated.View>

        {/* Score separator */}
        <View style={styles.scoreSeparator}>
          <Text style={styles.scoreSeparatorText}>:</Text>
        </View>

        {/* Away team score */}
        <Animated.View
          style={[styles.scoreValue, { transform: [{ scale: goalValueAnimAway }] }]}
        >
          <Text style={styles.scoreText}>{liveAwayScore ?? 0}</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    // Editable score controls for manual matches
    <View style={styles.goalActions}>
      {/* Home team goal controls */}
      <View style={styles.teamGoalControls}>
        <View style={styles.scoreControlRow}>
          <Animated.View style={{ transform: [{ scale: decrementAnimHome }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.blueButton]}
              onPress={() => {
                handleGoalDecrement(matchId, "home");
                animateButtonPress(decrementAnimHome);
              }}
            >
              <Ionicons name="remove" size={20} color={colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[styles.goalCounter, { transform: [{ scale: goalValueAnimHome }] }]}
          >
            <Text style={styles.goalValue}>{homeGoals ?? 0}</Text>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: incrementAnimHome }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.blueButton]}
              onPress={() => {
                handleGoalIncrement(matchId, "home");
                animateButtonPress(incrementAnimHome);
              }}
            >
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Away team goal controls */}
      <View style={styles.teamGoalControls}>
        <View style={styles.scoreControlRow}>
          <Animated.View style={{ transform: [{ scale: decrementAnimAway }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.blueButton]}
              onPress={() => {
                handleGoalDecrement(matchId, "away");
                animateButtonPress(decrementAnimAway);
              }}
            >
              <Ionicons name="remove" size={20} color={colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[styles.goalCounter, { transform: [{ scale: goalValueAnimAway }] }]}
          >
            <Text style={styles.goalValue}>{awayGoals ?? 0}</Text>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: incrementAnimAway }] }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.blueButton]}
              onPress={() => {
                handleGoalIncrement(matchId, "away");
                animateButtonPress(incrementAnimAway);
              }}
            >
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};
