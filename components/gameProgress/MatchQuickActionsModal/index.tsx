/**
 * @file MatchQuickActionsModal/index.tsx
 * @description Modal for quick match actions and stat visualizations (progress bars, possession circle) for a selected match.
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Animated,
  Image,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Player } from "../../../store/store";
import { useTeamLogo } from "../../../hooks/useTeamLogo";
import { useMatchQuickActionsAnimations } from "../../../hooks/useMatchQuickActionsAnimations";
import { useColors } from "../../../app/style/theme";
import { StatProgressBar } from "./StatProgressBar";
import { PossessionCircle } from "./PossessionCircle";
import { createStyles } from "./styles";
import { MatchQuickActionsModalProps } from "./types";

const useThemed = () => useColors();

/** Quick actions & stats modal for selected match (scores, scorers, assignments, stats). */
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
  const colors = useThemed();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWideLayout = screenWidth >= 1024;
  let playerColumnCount = 1;

  if (isWideLayout) {
    playerColumnCount = 3;
  } else if (screenWidth >= 720) {
    playerColumnCount = 2;
  }

  const modalWidth = Math.min(screenWidth - 32, isWideLayout ? 960 : 420);
  const styles = useMemo(
    () =>
      createStyles(
        colors,
        modalWidth,
        screenHeight,
        isWideLayout,
        playerColumnCount,
      ),
    [colors, isWideLayout, modalWidth, playerColumnCount, screenHeight],
  );
  const [activeTab, setActiveTab] = useState("overview");

  /** Selected match entity (or null). */
  const match = useMemo(() => {
    return selectedMatchId
      ? matches.find((m) => m.id === selectedMatchId)
      : null;
  }, [selectedMatchId, matches]);

  // Get team logos with async fallback support
  const homeTeamLogo = useTeamLogo(match?.homeTeam || '');
  const awayTeamLogo = useTeamLogo(match?.awayTeam || '');

  /** Live data for selected match (if present). */
  const liveMatchData = useMemo(() => {
    return liveMatches?.find((m) => m.id === selectedMatchId);
  }, [liveMatches, selectedMatchId]);

  /** Whether scores are driven by live API (read-only). */
  const isApiControlledMatch = useMemo(() => {
    return !!liveMatchData; // If liveMatchData exists, this is an API-controlled match
  }, [liveMatchData]);

  /** Goal scorers array for home team (live data). */
  const homeTeamScorers = useMemo(() => {
    return (
      liveMatchData?.goalScorers?.filter(
        (scorer) => scorer.teamId === liveMatchData.homeTeamId
      ) || []
    );
  }, [liveMatchData]);

  /** Goal scorers array for away team (live data). */
  const awayTeamScorers = useMemo(() => {
    return (
      liveMatchData?.goalScorers?.filter(
        (scorer) => scorer.teamId === liveMatchData.awayTeamId
      ) || []
    );
  }, [liveMatchData]);

  const {
    closeButtonAnim,
    goalValueAnimHome,
    goalValueAnimAway,
    modalContentAnim,
    incrementAnimHome,
    decrementAnimHome,
    incrementAnimAway,
    decrementAnimAway,
    animateButtonPress,
  } = useMatchQuickActionsAnimations({
    isVisible,
    match,
    liveMatchData,
    isApiControlledMatch,
  });

  /** Players impacted by this match (assigned or common). */
  const affectedPlayers = useMemo(() => {
    if (!match) return [];
    return players.filter(
      (p) =>
        match.id === commonMatchId ||
        playerAssignments[p.id]?.includes(match.id)
    );
  }, [match, players, commonMatchId, playerAssignments]);

  // Check if the selected match is the common match
  const isCommonMatch = match ? match.id === commonMatchId : false;

  /**
   * Distribute affected players into three columns for display.
   * @returns {Player[][]} 2D array; each sub-array is a column of players.
   */
  const playerColumns = useMemo(() => {
    const result: Player[][] = Array.from({ length: playerColumnCount }, () => []);

    affectedPlayers.forEach((player, index) => {
      const columnIndex = index % playerColumnCount;
      result[columnIndex].push(player);
    });

    return result;
  }, [affectedPlayers, playerColumnCount]);

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
                        source={homeTeamLogo}
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
                        source={awayTeamLogo}
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
                                {awayTeamScorers.map((scorer, index) => (
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
                                  key={column.map((player) => player.id).join("-") || `empty-${columnIndex}`}
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

export default MatchQuickActionsModal;
