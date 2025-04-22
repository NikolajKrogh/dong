import React, { useRef, useEffect, useMemo } from "react";
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
import { Match, Player } from "../../store/store";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import { MatchWithScore } from "../../hooks/useLiveScores";

/**
 * @interface MatchQuickActionsModalProps
 * @brief Defines the properties required by the MatchQuickActionsModal component.
 */
interface MatchQuickActionsModalProps {
  /** @param isVisible Boolean indicating if the modal should be visible. */
  isVisible: boolean;
  /** @param onClose Function to call when the modal should be closed. */
  onClose: () => void;
  /** @param selectedMatchId The ID of the match currently selected for quick actions, or null. */
  selectedMatchId: string | null;
  /** @param matches Array of all match objects from the game store. */
  matches: Match[];
  /** @param players Array of all player objects from the game store. */
  players: Player[];
  /** @param commonMatchId The ID of the match designated as 'common'. */
  commonMatchId: string;
  /** @param playerAssignments Record mapping player IDs to an array of match IDs they are assigned to. */
  playerAssignments: Record<string, string[]>;
  /** @param handleGoalIncrement Function to increment the goal count for a team in a match. */
  handleGoalIncrement: (matchId: string, team: "home" | "away") => void;
  /** @param handleGoalDecrement Function to decrement the goal count for a team in a match. */
  handleGoalDecrement: (matchId: string, team: "home" | "away") => void;
  /** @param liveMatches Array of live match objects with scores. */
  liveMatches: MatchWithScore[];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @component MatchQuickActionsModal
 * @brief A modal component displaying match information for a selected match.
 * Displays team information, current scores, goal scorers and players affected by the match.
 * @param {MatchQuickActionsModalProps} props - The properties for the component.
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
   * Returns the match object corresponding to `selectedMatchId` or null if not found or `selectedMatchId` is null.
   */
  const match = useMemo(() => {
    return selectedMatchId
      ? matches.find((m) => m.id === selectedMatchId)
      : null;
  }, [selectedMatchId, matches]);

  /**
   * @brief Memoized calculation to find the live match data for the selected match.
   * Returns the `MatchWithScore` object from `liveMatches` corresponding to `selectedMatchId`, or undefined if not found.
   */
  const liveMatchData = useMemo(() => {
    return liveMatches?.find((m) => m.id === selectedMatchId);
  }, [liveMatches, selectedMatchId]);

  /**
   * @brief Determines if the current match is controlled by the API or can be manually adjusted.
   * If a match has corresponding live data from an API, we should display scores without controls.
   * Otherwise, we should allow manual control of scores.
   */
  const isApiControlledMatch = useMemo(() => {
    return !!liveMatchData; // If liveMatchData exists, this is an API-controlled match
  }, [liveMatchData]);

  /**
   * @brief Memoized calculation to extract goal scorers for the home team from live match data.
   * Uses the explicit homeTeamId from the live match data to filter goal scorers.
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
   * Returns an array of Player objects.
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
  }, [match?.homeGoals, liveMatchData?.homeScore, isApiControlledMatch]);

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
  }, [match?.awayGoals, liveMatchData?.awayScore, isApiControlledMatch]);

  /**
   * @brief Memoized calculation to distribute affected players into three columns for display.
   * Returns a 2D array where each sub-array represents a column of players.
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
                      <Text style={styles.matchTeamName} numberOfLines={1}>
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
                      <Text style={styles.matchTeamName} numberOfLines={1}>
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
                          {liveMatchData?.homeScore || 0}
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
                          {liveMatchData?.awayScore || 0}
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
                              style={[styles.actionButton, styles.blueButton]}
                              onPress={() => {
                                handleGoalDecrement(match.id, "home");
                                animateButtonPress(decrementAnimHome);
                              }}
                            >
                              <Ionicons name="remove" size={20} color="#fff" />
                            </TouchableOpacity>
                          </Animated.View>

                          <Animated.View
                            style={[
                              styles.goalCounter,
                              { transform: [{ scale: goalValueAnimHome }] },
                            ]}
                          >
                            <Text style={styles.goalValue}>
                              {match.homeGoals || 0}
                            </Text>
                          </Animated.View>

                          <Animated.View
                            style={{
                              transform: [{ scale: incrementAnimHome }],
                            }}
                          >
                            <TouchableOpacity
                              style={[styles.actionButton, styles.blueButton]}
                              onPress={() => {
                                handleGoalIncrement(match.id, "home");
                                animateButtonPress(incrementAnimHome);
                              }}
                            >
                              <Ionicons name="add" size={20} color="#fff" />
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
                              style={[styles.actionButton, styles.blueButton]}
                              onPress={() => {
                                handleGoalDecrement(match.id, "away");
                                animateButtonPress(decrementAnimAway);
                              }}
                            >
                              <Ionicons name="remove" size={20} color="#fff" />
                            </TouchableOpacity>
                          </Animated.View>

                          <Animated.View
                            style={[
                              styles.goalCounter,
                              { transform: [{ scale: goalValueAnimAway }] },
                            ]}
                          >
                            <Text style={styles.goalValue}>
                              {match.awayGoals || 0}
                            </Text>
                          </Animated.View>

                          <Animated.View
                            style={{
                              transform: [{ scale: incrementAnimAway }],
                            }}
                          >
                            <TouchableOpacity
                              style={[styles.actionButton, styles.blueButton]}
                              onPress={() => {
                                handleGoalIncrement(match.id, "away");
                                animateButtonPress(incrementAnimAway);
                              }}
                            >
                              <Ionicons name="add" size={20} color="#fff" />
                            </TouchableOpacity>
                          </Animated.View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Goal Scorers Container - Show for API matches */}
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

                  {affectedPlayers.length > 0 && (
                    <View style={styles.sectionHeader}>
                      <Ionicons name="people" size={16} color="#555" />
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
                                              outputRange: [5, 0],
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
                      <Ionicons name="person-outline" size={24} color="#aaa" />
                      <Text style={styles.noPlayersText}>
                        No players affected
                      </Text>
                    </View>
                  )}

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
                        setTimeout(onClose, 100);
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

const styles = StyleSheet.create({
  overlayTouchable: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
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
    color: "#333",
    maxWidth: 120,
  },
  matchVsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  matchVsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  // Common match badge
  commonMatchBadge: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  commonMatchText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#eeeeee",
    width: "100%",
    marginVertical: 12,
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
    color: "#0275d8",
  },
  scoreSeparator: {
    paddingHorizontal: 8,
  },
  scoreSeparatorText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#777",
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
    color: "#333",
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
    color: "#0275d8",
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  blueButton: {
    backgroundColor: "#0275d8",
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
    color: "#444",
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
    color: "#555",
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
    backgroundColor: "#f6f6f6",
    borderRadius: 6,
    paddingVertical: 4, // Even more compact
    paddingHorizontal: 6,
    marginBottom: 4,
    marginHorizontal: 2,
  },
  compactPlayerName: {
    fontSize: 12, // Smaller font for compactness
    fontWeight: "500",
    color: "#333",
    textAlign: "center",
  },
  emptyStateContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 12,
  },
  noPlayersText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
    marginLeft: 8,
  },
  // Close button
  closeButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
});

export default MatchQuickActionsModal;
