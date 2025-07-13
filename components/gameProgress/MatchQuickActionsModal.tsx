/**
 * @file MatchQuickActionsModal.tsx
 * @brief Defines the MatchQuickActionsModal component and its sub-components for displaying match details and statistics.
 *
 * This file contains the main modal component used to show quick actions and information
 * related to a selected football match. It includes sub-components for displaying
 * progress bars for statistics and a circular chart for possession.
 */

import React, { useRef, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  Animated,
  Image,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Match, Player } from "../../store/store";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import { MatchWithScore } from "../../hooks/useLiveScores";
import { colors } from "../../app/style/palette";

/**
 * @interface MatchQuickActionsModalProps
 * @brief Defines the properties required by the MatchQuickActionsModal component.
 */
interface MatchQuickActionsModalProps {
  /** @param {boolean} isVisible Boolean indicating if the modal should be visible. */
  isVisible: boolean;
  /** @param {() => void} onClose Function to call when the modal should be closed. */
  onClose: () => void;
  /** @param {string | null} selectedMatchId The ID of the match currently selected for quick actions, or null. */
  selectedMatchId: string | null;
  /** @param {Match[]} matches Array of all match objects from the game store. */
  matches: Match[];
  /** @param {Player[]} players Array of all player objects from the game store. */
  players: Player[];
  /** @param {string} commonMatchId The ID of the match designated as 'common'. */
  commonMatchId: string;
  /** @param {Record<string, string[]>} playerAssignments Record mapping player IDs to an array of match IDs they are assigned to. */
  playerAssignments: Record<string, string[]>;
  /** @param {(matchId: string, team: "home" | "away") => void} handleGoalIncrement Function to increment the goal count for a team in a match. */
  handleGoalIncrement: (matchId: string, team: "home" | "away") => void;
  /** @param {(matchId: string, team: "home" | "away") => void} handleGoalDecrement Function to decrement the goal count for a team in a match. */
  handleGoalDecrement: (matchId: string, team: "home" | "away") => void;
  /** @param {MatchWithScore[]} liveMatches Array of live match objects with scores. */
  liveMatches: MatchWithScore[];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @component StatProgressBar
 * @brief A component for visual stat comparison using horizontal bars.
 * @param {object} props - The component's props.
 * @param {number} props.homeValue - The value for the home team.
 * @param {number} props.awayValue - The value for the away team.
 * @param {string} props.label - The label for the statistic.
 * @param {boolean} [props.isPercentage=false] - Whether to show values as percentages (for possession).
 * @returns {React.ReactElement} A View containing the stat progress bar.
 */
const StatProgressBar = ({
  homeValue,
  awayValue,
  label,
  isPercentage = false,
}: {
  homeValue: number;
  awayValue: number;
  label: string;
  isPercentage?: boolean;
}) => {
  const maxValue = Math.max(1, homeValue, awayValue); // Ensure maxValue is at least 1 to avoid division by zero
  const homePercent = (homeValue / maxValue) * 100;
  const awayPercent = (awayValue / maxValue) * 100;

  const barHeight = 8; // Height of the progress bars
  const totalBarWidth = 100; // Represents 100% width for calculations
  const homeBarWidth = (homePercent / 100) * (totalBarWidth / 2);
  const awayBarWidth = (awayPercent / 100) * (totalBarWidth / 2);

  const homeColor = colors.primary;
  const awayColor = colors.awayTeam;
  const dividerColor = colors.darkSurface;

  return (
    <View
      style={styles.statProgressContainer}
      accessible={true}
      accessibilityLabel={`${label}: Home ${homeValue}${
        isPercentage ? "%" : ""
      }, Away ${awayValue}${isPercentage ? "%" : ""}`}
    >
      <Text style={styles.statValue}>
        {homeValue}
        {isPercentage ? "%" : ""}
      </Text>

      <View style={styles.statProgressWrapper}>
        <Text style={styles.statProgressLabel}>{label}</Text>
        <View style={styles.svgProgressBarContainer}>
          <Svg height={barHeight} width="100%">
            {/* Background for Home Side */}
            <Rect
              x="0"
              y="0"
              width="50%"
              height={barHeight}
              fill={styles.homeProgressArea.backgroundColor}
              rx={styles.homeProgressBar.borderTopLeftRadius} // Optional: for rounded corners
              ry={styles.homeProgressBar.borderTopLeftRadius}
            />
            {/* Home Progress */}
            <Rect
              x={`${50 - homeBarWidth}%`} // Start from the right edge of the home area and draw left
              y="0"
              width={`${homeBarWidth}%`}
              height={barHeight}
              fill={homeColor}
              rx={styles.homeProgressBar.borderTopLeftRadius}
              ry={styles.homeProgressBar.borderTopLeftRadius}
            />

            {/* Background for Away Side */}
            <Rect
              x="50%"
              y="0"
              width="50%"
              height={barHeight}
              fill={styles.awayProgressArea.backgroundColor}
              rx={styles.awayProgressBar.borderTopRightRadius} // Optional: for rounded corners
              ry={styles.awayProgressBar.borderTopRightRadius}
            />
            {/* Away Progress */}
            <Rect
              x="50%"
              y="0"
              width={`${awayBarWidth}%`}
              height={barHeight}
              fill={awayColor}
              rx={styles.awayProgressBar.borderTopRightRadius}
              ry={styles.awayProgressBar.borderTopRightRadius}
            />

            {/* Center Divider */}
            <Rect
              x="50%"
              y="0"
              width={styles.progressDivider.width}
              height={barHeight}
              fill={dividerColor}
              transform="translate(-1)" // Adjust to center the 2px divider
            />
          </Svg>
        </View>
      </View>

      <Text style={styles.statValue}>
        {awayValue}
        {isPercentage ? "%" : ""}
      </Text>
    </View>
  );
};

// Helper functions for SVG arc
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean = false
): string {
  if (startAngle === endAngle || Math.abs(startAngle - endAngle) < 0.01) {
    return ""; // No arc to draw
  }
  // Ensure endAngle is slightly different from startAngle if it's a full circle from 0 to 360
  if (
    Math.abs(endAngle - startAngle - 360) < 0.01 ||
    Math.abs(endAngle - startAngle + 360) < 0.01
  ) {
    endAngle = startAngle + (endAngle > startAngle ? 359.99 : -359.99);
  } else if (endAngle >= 360 && startAngle === 0) {
    endAngle = 359.99;
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  const sweepFlag = counterClockwise ? "1" : "0"; // 0 for clockwise, 1 for counter-clockwise

  const d = [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    sweepFlag,
    end.x,
    end.y,
  ].join(" ");

  return d;
}

/**
 * @component PossessionCircle
 * @brief A circular visualization for possession statistics using a doughnut chart.
 * @param {object} props - The component's props.
 * @param {number} props.homeValue - The possession value for the home team.
 * @param {number} props.awayValue - The possession value for the away team.
 * @returns {React.ReactElement} A View containing the possession circle.
 */
const PossessionCircle = ({
  homeValue,
  awayValue,
}: {
  homeValue: number;
  awayValue: number;
}) => {
  const total = homeValue + awayValue;
  const normalizedHome = total > 0 ? Math.round((homeValue / total) * 100) : 0;
  const normalizedAway = total > 0 ? Math.round((awayValue / total) * 100) : 0;

  const size = 90; // Diameter of the doughnut
  const strokeWidth = 18; // Thickness of the doughnut ring
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const homeColor = colors.primary;
  const awayColor = colors.awayTeam;
  const trackColor = colors.borderLight; // Background track color

  const homeAngle = (normalizedHome / 100) * 360;
  const awayAngle = (normalizedAway / 100) * 360;

  // Path for the background track (full circle)
  const trackPath = describeArc(cx, cy, radius, 0, 359.99);

  // Path for home team's possession - counter-clockwise from 0
  const homeArcPath =
    homeAngle > 0
      ? describeArc(cx, cy, radius, 0, -homeAngle, true) // Negative angle for counter-clockwise
      : "";

  // Path for away team's possession - clockwise from 0
  const awayArcPath =
    awayAngle > 0 ? describeArc(cx, cy, radius, 0, awayAngle) : "";

  return (
    <View style={styles.possessionContainer}>
      <Text style={styles.statValue}>{normalizedHome}%</Text>

      <View style={styles.possessionCircleContainer}>
        <Text style={styles.statProgressLabel}>Possession</Text>
        <View style={styles.circleWrapper}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={trackPath}
              stroke={trackColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {homeArcPath ? (
              <Path
                d={homeArcPath}
                stroke={homeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
            {awayArcPath ? (
              <Path
                d={awayArcPath}
                stroke={awayColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
          </Svg>
        </View>
      </View>

      <Text style={styles.statValue}>{normalizedAway}%</Text>
    </View>
  );
};

/**
 * @component MatchQuickActionsModal
 * @brief A modal component displaying match information for a selected match.
 * Displays team information, current scores, goal scorers, players affected by the match, and statistics.
 * @param {MatchQuickActionsModalProps} props - The properties for the component.
 * @returns {React.ReactElement | null} The modal component or null if not visible or no match selected.
 */
const MatchQuickActionsModal: React.FC<MatchQuickActionsModalProps> = ({
  isVisible,
  onClose,
  selectedMatchId,
  matches,
  players,
  commonMatchId,
  playerAssignments,
  liveMatches,
  handleGoalIncrement,
  handleGoalDecrement,
}) => {
  const [activeTab, setActiveTab] = useState("overview");

  // Animation values for UI elements
  const closeButtonAnim = useRef(new Animated.Value(1)).current;
  const goalValueAnimHome = useRef(new Animated.Value(1)).current;
  const goalValueAnimAway = useRef(new Animated.Value(1)).current;
  const modalContentAnim = useRef(new Animated.Value(0)).current;
  const incrementAnimHome = useRef(new Animated.Value(1)).current;
  const decrementAnimHome = useRef(new Animated.Value(1)).current;
  const incrementAnimAway = useRef(new Animated.Value(1)).current;
  const decrementAnimAway = useRef(new Animated.Value(1)).current;

  /**
   * @brief Memoized calculation to find the currently selected match object.
   * @returns {Match | null} The match object corresponding to `selectedMatchId` or null if not found or `selectedMatchId` is null.
   */
  const match = useMemo(() => {
    return selectedMatchId
      ? matches.find((m) => m.id === selectedMatchId)
      : null;
  }, [selectedMatchId, matches]);

  /**
   * @brief Memoized calculation to find the live match data for the selected match.
   * @returns {MatchWithScore | undefined} The `MatchWithScore` object from `liveMatches` corresponding to `selectedMatchId`, or undefined if not found.
   */
  const liveMatchData = useMemo(() => {
    return liveMatches?.find((m) => m.id === selectedMatchId);
  }, [liveMatches, selectedMatchId]);

  /**
   * @brief Determines if the current match is controlled by an API or can be manually adjusted.
   * If a match has corresponding live data from an API, scores are displayed read-only.
   * Otherwise, manual score controls are shown.
   * @returns {boolean} True if the match is API-controlled, false otherwise.
   */
  const isApiControlledMatch = useMemo(() => {
    return !!liveMatchData; // If liveMatchData exists, this is an API-controlled match
  }, [liveMatchData]);

  /**
   * @brief Memoized calculation to extract goal scorers for the home team from live match data.
   * Uses the explicit homeTeamId from the live match data to filter goal scorers.
   * @returns {Array<object>} An array of goal scorer objects for the home team, or an empty array.
   */
  const homeTeamScorers = useMemo(() => {
    return (
      liveMatchData?.goalScorers?.filter(
        (scorer) => scorer.teamId === liveMatchData.homeTeamId
      ) || []
    );
  }, [liveMatchData]);

  /**
   * @brief Memoized calculation to extract goal scorers for the away team from live match data.
   * Uses the explicit awayTeamId from the live match data to filter goal scorers.
   * @returns {Array<object>} An array of goal scorer objects for the away team, or an empty array.
   */
  const awayTeamScorers = useMemo(() => {
    return (
      liveMatchData?.goalScorers?.filter(
        (scorer) => scorer.teamId === liveMatchData.awayTeamId
      ) || []
    );
  }, [liveMatchData]);

  // References to store previous goal values for animation triggering
  const prevGoalsHomeRef = useRef(match?.homeGoals ?? 0);
  const prevGoalsAwayRef = useRef(match?.awayGoals ?? 0);

  /**
   * @brief Memoized calculation to determine players affected by the selected match.
   * Filters the players list to include those assigned to the selected match or the common match.
   * @returns {Player[]} An array of Player objects.
   */
  const affectedPlayers = useMemo(() => {
    if (!match) return [];
    return players.filter(
      (p) =>
        match.id === commonMatchId ||
        (playerAssignments[p.id] && playerAssignments[p.id].includes(match.id))
    );
  }, [match, players, commonMatchId, playerAssignments]);

  // Check if the selected match is the common match
  const isCommonMatch = match ? match.id === commonMatchId : false;

  /**
   * @brief Animates a button press effect (scale down then back up).
   * @param {Animated.Value} buttonAnim - The Animated value associated with the button's scale transform.
   */
  const animateButtonPress = (buttonAnim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(buttonAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * @brief Effect to handle the modal's entry animation (fade in and scale up).
   * Runs when the modal becomes visible and a match is selected. Resets animation on close.
   */
  useEffect(() => {
    if (isVisible && match) {
      Animated.timing(modalContentAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    // Reset animation when closing
    return () => {
      if (!isVisible) {
        modalContentAnim.setValue(0);
      }
    };
  }, [isVisible, match, modalContentAnim]);

  /**
   * @brief Effect to animate the home goal value when it changes (scale up then back down).
   * Compares the current home goal count with the previously stored value.
   */
  useEffect(() => {
    // Get the current score (prioritize live data if available)
    const currentScore = isApiControlledMatch
      ? liveMatchData?.homeScore ?? 0
      : match?.homeGoals ?? 0;

    if (prevGoalsHomeRef.current !== currentScore) {
      // Run animation
      Animated.sequence([
        Animated.timing(goalValueAnimHome, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(goalValueAnimHome, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      prevGoalsHomeRef.current = currentScore;
    }
  }, [
    match?.homeGoals,
    liveMatchData?.homeScore,
    isApiControlledMatch,
    goalValueAnimHome,
    liveMatchData,
  ]); // Added goalValueAnimHome and liveMatchData to dependency array

  /**
   * @brief Effect to animate the away goal value when it changes (scale up then back down).
   * Compares the current away goal count with the previously stored value.
   */
  useEffect(() => {
    // Get the current score (prioritize live data if available)
    const currentScore = isApiControlledMatch
      ? liveMatchData?.awayScore ?? 0
      : match?.awayGoals ?? 0;

    if (prevGoalsAwayRef.current !== currentScore) {
      // Run animation
      Animated.sequence([
        Animated.timing(goalValueAnimAway, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(goalValueAnimAway, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      prevGoalsAwayRef.current = currentScore;
    }
  }, [
    match?.awayGoals,
    liveMatchData?.awayScore,
    isApiControlledMatch,
    goalValueAnimAway,
    liveMatchData,
  ]); // Added goalValueAnimAway and liveMatchData to dependency array

  /**
   * @brief Memoized calculation to distribute affected players into three columns for display.
   * @returns {Player[][]} A 2D array where each sub-array represents a column of players.
   */
  const playerColumns = useMemo(() => {
    const result: Player[][] = [[], [], []];

    affectedPlayers.forEach((player, index) => {
      const columnIndex = index % 3;
      result[columnIndex].push(player);
    });

    return result;
  }, [affectedPlayers]);

  // If no match is selected or the modal is not visible, render nothing.
  if (!match || !isVisible) return null;

  return (
    <SafeAreaView style={{ flex: 0 }}>
      <Modal
        animationType="none"
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.centeredView}>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  opacity: modalContentAnim,
                  transform: [
                    {
                      scale: modalContentAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.modalInnerContainer}
              >
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Teams Header */}
                  <View style={styles.matchHeaderSection}>
                    {/* Home team */}
                    <View style={styles.matchTeamContainer}>
                      <Image
                        source={getTeamLogoWithFallback(match.homeTeam)}
                        style={styles.matchTeamLogo}
                      />
                      <Text style={styles.matchTeamName} numberOfLines={2}>
                        {match.homeTeam}
                      </Text>
                    </View>

                    {/* VS badge */}
                    <View style={styles.matchVsBadge}>
                      <Text style={styles.matchVsText}>VS</Text>
                    </View>

                    {/* Away team */}
                    <View style={styles.matchTeamContainer}>
                      <Image
                        source={getTeamLogoWithFallback(match.awayTeam)}
                        style={styles.matchTeamLogo}
                      />
                      <Text style={styles.matchTeamName} numberOfLines={2}>
                        {match.awayTeam}
                      </Text>
                    </View>
                  </View>

                  {/* Common match badge if applicable */}
                  {isCommonMatch && (
                    <View style={styles.commonMatchBadge}>
                      <Text style={styles.commonMatchText}>Common Match</Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* Tab Navigation */}
                  <View style={styles.tabContainer}>
                    <TouchableOpacity
                      style={[
                        styles.tabButton,
                        activeTab === "overview" && styles.activeTab,
                      ]}
                      onPress={() => setActiveTab("overview")}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          activeTab === "overview" && styles.activeTabText,
                        ]}
                      >
                        Overview
                      </Text>
                    </TouchableOpacity>

                    {isApiControlledMatch &&
                      liveMatchData?.homeTeamStatistics && ( // Only show stats tab if data exists
                        <TouchableOpacity
                          style={[
                            styles.tabButton,
                            activeTab === "statistics" && styles.activeTab,
                          ]}
                          onPress={() => setActiveTab("statistics")}
                        >
                          <Text
                            style={[
                              styles.tabText,
                              activeTab === "statistics" &&
                                styles.activeTabText,
                            ]}
                          >
                            Statistics
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>

                  <View style={styles.divider} />

                  {/* Overview Tab Content */}
                  {activeTab === "overview" && (
                    <>
                      {isApiControlledMatch ? (
                        // Read-only score display for API matches
                        <View style={styles.scoreContainer}>
                          {/* Home team score */}
                          <Animated.View
                            style={[
                              styles.scoreValue,
                              { transform: [{ scale: goalValueAnimHome }] },
                            ]}
                          >
                            <Text style={styles.scoreText}>
                              {liveMatchData?.homeScore ?? 0}
                            </Text>
                          </Animated.View>

                          {/* Score separator */}
                          <View style={styles.scoreSeparator}>
                            <Text style={styles.scoreSeparatorText}>:</Text>
                          </View>

                          {/* Away team score */}
                          <Animated.View
                            style={[
                              styles.scoreValue,
                              { transform: [{ scale: goalValueAnimAway }] },
                            ]}
                          >
                            <Text style={styles.scoreText}>
                              {liveMatchData?.awayScore ?? 0}
                            </Text>
                          </Animated.View>
                        </View>
                      ) : (
                        // Editable score controls for manual matches
                        <View style={styles.goalActions}>
                          {/* Home team goal controls */}
                          <View style={styles.teamGoalControls}>
                            <View style={styles.scoreControlRow}>
                              <Animated.View
                                style={{
                                  transform: [{ scale: decrementAnimHome }],
                                }}
                              >
                                <TouchableOpacity
                                  style={[
                                    styles.actionButton,
                                    styles.blueButton,
                                  ]}
                                  onPress={() => {
                                    handleGoalDecrement(match.id, "home");
                                    animateButtonPress(decrementAnimHome);
                                  }}
                                >
                                  <Ionicons
                                    name="remove"
                                    size={20}
                                    color={colors.white}
                                  />
                                </TouchableOpacity>
                              </Animated.View>

                              <Animated.View
                                style={[
                                  styles.goalCounter,
                                  {
                                    transform: [{ scale: goalValueAnimHome }],
                                  },
                                ]}
                              >
                                <Text style={styles.goalValue}>
                                  {match.homeGoals ?? 0}
                                </Text>
                              </Animated.View>

                              <Animated.View
                                style={{
                                  transform: [{ scale: incrementAnimHome }],
                                }}
                              >
                                <TouchableOpacity
                                  style={[
                                    styles.actionButton,
                                    styles.blueButton,
                                  ]}
                                  onPress={() => {
                                    handleGoalIncrement(match.id, "home");
                                    animateButtonPress(incrementAnimHome);
                                  }}
                                >
                                  <Ionicons
                                    name="add"
                                    size={20}
                                    color={colors.white}
                                  />
                                </TouchableOpacity>
                              </Animated.View>
                            </View>
                          </View>

                          {/* Away team goal controls */}
                          <View style={styles.teamGoalControls}>
                            <View style={styles.scoreControlRow}>
                              <Animated.View
                                style={{
                                  transform: [{ scale: decrementAnimAway }],
                                }}
                              >
                                <TouchableOpacity
                                  style={[
                                    styles.actionButton,
                                    styles.blueButton,
                                  ]}
                                  onPress={() => {
                                    handleGoalDecrement(match.id, "away");
                                    animateButtonPress(decrementAnimAway);
                                  }}
                                >
                                  <Ionicons
                                    name="remove"
                                    size={20}
                                    color={colors.white}
                                  />
                                </TouchableOpacity>
                              </Animated.View>

                              <Animated.View
                                style={[
                                  styles.goalCounter,
                                  {
                                    transform: [{ scale: goalValueAnimAway }],
                                  },
                                ]}
                              >
                                <Text style={styles.goalValue}>
                                  {match.awayGoals ?? 0}
                                </Text>
                              </Animated.View>

                              <Animated.View
                                style={{
                                  transform: [{ scale: incrementAnimAway }],
                                }}
                              >
                                <TouchableOpacity
                                  style={[
                                    styles.actionButton,
                                    styles.blueButton,
                                  ]}
                                  onPress={() => {
                                    handleGoalIncrement(match.id, "away");
                                    animateButtonPress(incrementAnimAway);
                                  }}
                                >
                                  <Ionicons
                                    name="add"
                                    size={20}
                                    color={colors.white}
                                  />
                                </TouchableOpacity>
                              </Animated.View>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Goal Scorers Section */}
                      {isApiControlledMatch && (
                        <View style={styles.goalScorersContainer}>
                          {/* Home team scorers */}
                          <View style={styles.teamScorersColumn}>
                            {homeTeamScorers.length > 0 ? (
                              <View style={styles.scorerContainer}>
                                {homeTeamScorers.map((scorer, index) => (
                                  <Text
                                    key={`home-${index}`}
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
                                {awayTeamScorers.map((scorer, index) => (
                                  <Text
                                    key={`away-${index}`}
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
                      )}

                      <View style={styles.divider} />

                      {/* Players Section */}
                      {affectedPlayers.length > 0 && (
                        <View style={styles.sectionHeader}>
                          <Ionicons
                            name="people"
                            size={16}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.sectionTitle}>
                            Players ({affectedPlayers.length})
                          </Text>
                        </View>
                      )}

                      {affectedPlayers.length > 0 ? (
                        <View style={styles.compactContainer}>
                          {playerColumns.map(
                            (column, columnIndex) =>
                              column.length > 0 && (
                                <View
                                  key={`column-${columnIndex}`}
                                  style={styles.playerColumn}
                                >
                                  {column.map((player) => (
                                    <Animated.View
                                      key={player.id}
                                      style={[
                                        styles.compactPlayerCard,
                                        {
                                          opacity: modalContentAnim,
                                          transform: [
                                            {
                                              translateY:
                                                modalContentAnim.interpolate({
                                                  inputRange: [0, 1],
                                                  outputRange: [5, 0], //NOSONAR - Animation value
                                                }),
                                            },
                                          ],
                                        },
                                      ]}
                                    >
                                      <Text style={styles.compactPlayerName}>
                                        {player.name}
                                      </Text>
                                    </Animated.View>
                                  ))}
                                </View>
                              )
                          )}
                        </View>
                      ) : (
                        <View style={styles.emptyStateContainer}>
                          <Ionicons
                            name="person-outline"
                            size={24}
                            color={colors.textMuted}
                          />
                          <Text style={styles.noPlayersText}>
                            No players affected
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Statistics Tab Content */}
                  {activeTab === "statistics" &&
                    isApiControlledMatch &&
                    liveMatchData?.homeTeamStatistics && // Ensure home stats exist
                    liveMatchData?.awayTeamStatistics && ( // Ensure away stats exist
                      <View style={styles.statisticsContainer}>
                        <PossessionCircle
                          homeValue={
                            liveMatchData.homeTeamStatistics.possession ?? 0 // Default to 0 if undefined
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.possession ?? 0 // Default to 0 if undefined
                          }
                        />

                        <StatProgressBar
                          homeValue={
                            liveMatchData.homeTeamStatistics.shotsOnGoal ?? 0
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.shotsOnGoal ?? 0
                          }
                          label="Shots on Goal"
                        />

                        <StatProgressBar
                          homeValue={
                            liveMatchData.homeTeamStatistics.shotAttempts ?? 0
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.shotAttempts ?? 0
                          }
                          label="Shot Attempts"
                        />

                        <StatProgressBar
                          homeValue={
                            liveMatchData.homeTeamStatistics.fouls ?? 0
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.fouls ?? 0
                          }
                          label="Fouls"
                        />

                        <StatProgressBar
                          homeValue={
                            liveMatchData.homeTeamStatistics.yellowCards ?? 0
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.yellowCards ?? 0
                          }
                          label="Yellow Cards"
                        />

                        <StatProgressBar
                          homeValue={
                            liveMatchData.homeTeamStatistics.redCards ?? 0
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.redCards ?? 0
                          }
                          label="Red Cards"
                        />

                        <StatProgressBar
                          homeValue={
                            liveMatchData.homeTeamStatistics.cornerKicks ?? 0
                          }
                          awayValue={
                            liveMatchData.awayTeamStatistics.cornerKicks ?? 0
                          }
                          label="Corner Kicks"
                        />
                      </View>
                    )}

                  {/* Close Button */}
                  <Animated.View
                    style={{
                      transform: [{ scale: closeButtonAnim }],
                      width: "100%",
                    }}
                  >
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        animateButtonPress(closeButtonAnim);
                        setTimeout(onClose, 100); // Delay close for animation
                      }}
                    >
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </ScrollView>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

/**
 * @brief StyleSheet for the MatchQuickActionsModal and its sub-components.
 */
const styles = StyleSheet.create({
  overlayTouchable: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.backgroundModalOverlay,
    zIndex: 1000,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 1001,
  },
  modalInnerContainer: {
    width: "100%",
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
  },
  // Match header styling to match MatchesGrid
  matchHeaderSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingBottom: 12,
  },
  matchTeamContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  matchTeamLogo: {
    width: 50,
    height: 50,
    resizeMode: "contain",
    marginBottom: 8,
  },
  matchTeamName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    color: colors.textSecondary,
    width: "100%",
  },
  matchVsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  matchVsText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  // Common match badge
  commonMatchBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  commonMatchText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLighter,
    width: "100%",
    marginVertical: 12,
  },
  // Tab container
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 12,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundSubtle,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
  },
  // For API matches - read only display
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
  },
  scoreValue: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  scoreText: {
    fontSize: 42,
    fontWeight: "bold",
    color: colors.primary,
  },
  scoreSeparator: {
    paddingHorizontal: 8,
  },
  scoreSeparatorText: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.textMuted,
  },
  // For editable matches - with controls
  goalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8,
  },
  teamGoalControls: {
    flex: 1,
    alignItems: "center",
  },
  teamLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  scoreControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  goalCounter: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  goalValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.primary,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  blueButton: {
    backgroundColor: colors.primary,
  },
  // Goal Scorers display
  goalScorersContainer: {
    flexDirection: "row",
    width: "100%",
    minHeight: 0, // Minimum height even when empty
    maxHeight: 120, // Maximum height before scrolling
  },
  teamScorersColumn: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  scorerContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 4,
  },
  scorerText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginVertical: 2,
    fontStyle: "italic",
    textAlign: "center",
  },
  // Players section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    marginLeft: 8,
  },
  // Player section - super compact layout
  compactContainer: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 12,
    justifyContent: "flex-start",
  },
  playerColumn: {
    flex: 1,
    marginHorizontal: 2,
  },
  compactPlayerCard: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingVertical: 4, // Even more compact
    paddingHorizontal: 6,
    marginBottom: 4,
    marginHorizontal: 2,
  },
  compactPlayerName: {
    fontSize: 12, // Smaller font for compactness
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyStateContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    marginBottom: 12,
  },
  noPlayersText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
    marginLeft: 8,
  },
  // Close button
  closeButton: {
    backgroundColor: colors.backgroundSubtle,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  // Match statistics section
  statisticsContainer: {
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statProgressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8, // Increased margin slightly
    width: "100%",
  },
  statProgressWrapper: {
    flex: 3,
    marginHorizontal: 8, // Add some horizontal margin
  },
  statProgressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 4,
  },
  svgProgressBarContainer: {
    // New or repurposed style for SVG wrapper
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 8, // Match barHeight
  },
  statValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textSecondary,
  },
  homeProgressArea: {
    // Used for background color reference
    backgroundColor: colors.primaryLight,
  },
  awayProgressArea: {
    // Used for background color reference
    backgroundColor: colors.playerItemOddBackground,
  },
  progressDivider: {
    // Used for width and color reference
    width: 2,
    backgroundColor: colors.darkSurface,
  },
  homeProgressBar: {
    // Used for borderRadius reference
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  awayProgressBar: {
    // Used for borderRadius reference
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  possessionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 15,
    width: "100%",
  },
  possessionCircleContainer: {
    flex: 3,
    alignItems: "center",
  },
  circleWrapper: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginTop: 5,
  },
});

export default MatchQuickActionsModal;
