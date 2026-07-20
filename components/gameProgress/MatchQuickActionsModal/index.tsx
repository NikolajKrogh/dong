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
  useWindowDimensions,
} from "react-native";
import { Player } from "../../../store/store";
import { useTeamLogo } from "../../../hooks/useTeamLogo";
import { useMatchQuickActionsAnimations } from "../../../hooks/useMatchQuickActionsAnimations";
import { useColors } from "../../../app/style/theme";
import { MatchHeader } from "./MatchHeader";
import { ModalTabBar } from "./ModalTabBar";
import { ScoreControls } from "./ScoreControls";
import { GoalScorersSection } from "./GoalScorersSection";
import { PlayersSection } from "./PlayersSection";
import { StatisticsSection } from "./StatisticsSection";
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

  const showStatisticsTab = Boolean(
    isApiControlledMatch && liveMatchData?.homeTeamStatistics,
  );

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
                  <MatchHeader
                    homeTeam={match.homeTeam}
                    awayTeam={match.awayTeam}
                    homeTeamLogo={homeTeamLogo}
                    awayTeamLogo={awayTeamLogo}
                    isCommonMatch={isCommonMatch}
                    styles={styles}
                  />

                  <View style={styles.divider} />

                  <ModalTabBar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    showStatisticsTab={showStatisticsTab}
                    styles={styles}
                  />

                  <View style={styles.divider} />

                  {/* Overview Tab Content */}
                  {activeTab === "overview" && (
                    <>
                      <ScoreControls
                        matchId={match.id}
                        homeGoals={match.homeGoals ?? 0}
                        awayGoals={match.awayGoals ?? 0}
                        isApiControlledMatch={isApiControlledMatch}
                        liveHomeScore={liveMatchData?.homeScore ?? 0}
                        liveAwayScore={liveMatchData?.awayScore ?? 0}
                        goalValueAnimHome={goalValueAnimHome}
                        goalValueAnimAway={goalValueAnimAway}
                        incrementAnimHome={incrementAnimHome}
                        decrementAnimHome={decrementAnimHome}
                        incrementAnimAway={incrementAnimAway}
                        decrementAnimAway={decrementAnimAway}
                        animateButtonPress={animateButtonPress}
                        handleGoalIncrement={handleGoalIncrement}
                        handleGoalDecrement={handleGoalDecrement}
                        styles={styles}
                      />

                      {isApiControlledMatch && (
                        <GoalScorersSection
                          homeTeamScorers={homeTeamScorers}
                          awayTeamScorers={awayTeamScorers}
                          styles={styles}
                        />
                      )}

                      <View style={styles.divider} />

                      <PlayersSection
                        affectedPlayersCount={affectedPlayers.length}
                        playerColumns={playerColumns}
                        modalContentAnim={modalContentAnim}
                        styles={styles}
                      />
                    </>
                  )}

                  {/* Statistics Tab Content */}
                  {activeTab === "statistics" &&
                    isApiControlledMatch &&
                    liveMatchData?.homeTeamStatistics &&
                    liveMatchData?.awayTeamStatistics && (
                      <StatisticsSection
                        homeStats={liveMatchData.homeTeamStatistics}
                        awayStats={liveMatchData.awayTeamStatistics}
                        styles={styles}
                      />
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
