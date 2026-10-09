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
  Animated,
  useWindowDimensions,
} from "react-native";
import { Player } from "../../../store/store";
import { useTeamLogo } from "../../../hooks/useTeamLogo";
import { useMatchQuickActionsAnimations } from "../../../hooks/useMatchQuickActionsAnimations";
import { useColors } from "../../../styles/theme";
import { MatchHeader } from "./MatchHeader";
import { ModalTabBar } from "./ModalTabBar";
import { ScoreControls } from "./ScoreControls";
import { GoalScorersSection } from "./GoalScorersSection";
import { PlayersSection } from "./PlayersSection";
import { StatisticsSection } from "./StatisticsSection";
import { createStyles } from "./styles";
import { MatchQuickActionsModalProps } from "./types";

const useThemed = () => useColors();

type ScoreControlValues = Omit<
  React.ComponentProps<typeof ScoreControls>,
  "styles"
>;
type GoalScorerValues = Omit<
  React.ComponentProps<typeof GoalScorersSection>,
  "styles"
>;
type PlayerValues = Omit<
  React.ComponentProps<typeof PlayersSection>,
  "styles"
>;
type LiveMatch = NonNullable<MatchQuickActionsModalProps["liveMatches"]>[number];
type TrackedMatch = MatchQuickActionsModalProps["matches"][number];

interface MatchTabContentProps {
  activeTab: string;
  scoreControls: ScoreControlValues;
  isApiControlledMatch: boolean;
  goalScorers: GoalScorerValues;
  players: PlayerValues;
  statistics: {
    homeStats: NonNullable<LiveMatch["homeTeamStatistics"]>;
    awayStats: NonNullable<LiveMatch["awayTeamStatistics"]>;
  } | null;
  styles: ReturnType<typeof createStyles>;
}

const MatchTabContent = ({
  activeTab,
  scoreControls,
  isApiControlledMatch,
  goalScorers,
  players,
  statistics,
  styles,
}: MatchTabContentProps) => {
  if (activeTab === "overview") {
    return (
      <>
        <ScoreControls {...scoreControls} styles={styles} />
        {isApiControlledMatch ? (
          <GoalScorersSection {...goalScorers} styles={styles} />
        ) : null}
        <View style={styles.divider} />
        <PlayersSection {...players} styles={styles} />
      </>
    );
  }

  if (activeTab === "statistics" && statistics) {
    return <StatisticsSection {...statistics} styles={styles} />;
  }

  return null;
};

const getPlayerColumnCount = (screenWidth: number) => {
  if (screenWidth >= 1024) return 3;
  if (screenWidth >= 720) return 2;
  return 1;
};

const findSelectedMatch = (
  matches: TrackedMatch[],
  selectedMatchId: string | null,
) =>
  selectedMatchId
    ? (matches.find((candidate) => candidate.id === selectedMatchId) ?? null)
    : null;

const findLiveMatch = (liveMatches: LiveMatch[], selectedMatchId: string | null) =>
  liveMatches.find((candidate) => candidate.id === selectedMatchId);

const isProviderControlledMatch = (
  match: TrackedMatch | null,
  liveMatchData: LiveMatch | undefined,
) =>
  (match?.sourceProvider != null &&
    match.sourceProvider.toLowerCase() !== "manual") ||
  Boolean(liveMatchData);

const getTeamScorers = (
  liveMatchData: LiveMatch | undefined,
  team: "home" | "away",
) => {
  if (!liveMatchData) return [];
  const teamId = team === "home" ? liveMatchData.homeTeamId : liveMatchData.awayTeamId;
  return liveMatchData.goalScorers?.filter((scorer) => scorer.teamId === teamId) || [];
};

const getAffectedPlayers = (
  match: TrackedMatch | null,
  players: Player[],
  commonMatchId: string,
  playerAssignments: Record<string, string[]>,
) => {
  if (!match) return [];
  return players.filter(
    (player) =>
      match.id === commonMatchId ||
      playerAssignments[player.id]?.includes(match.id),
  );
};

const distributePlayers = (players: Player[], columnCount: number) => {
  const columns: Player[][] = Array.from({ length: columnCount }, () => []);
  players.forEach((player, index) => {
    columns[index % columnCount].push(player);
  });
  return columns;
};

const isCommonMatchSelection = (
  match: TrackedMatch | null,
  commonMatchId: string,
) => Boolean(match && match.id === commonMatchId);

const shouldShowStatisticsTab = (
  isApiControlledMatch: boolean,
  liveMatchData: LiveMatch | undefined,
) => Boolean(isApiControlledMatch && liveMatchData?.homeTeamStatistics);

const getMatchStatistics = (
  isApiControlledMatch: boolean,
  liveMatchData: LiveMatch | undefined,
): MatchTabContentProps["statistics"] => {
  if (
    !isApiControlledMatch ||
    !liveMatchData?.homeTeamStatistics ||
    !liveMatchData.awayTeamStatistics
  ) {
    return null;
  }
  return {
    homeStats: liveMatchData.homeTeamStatistics,
    awayStats: liveMatchData.awayTeamStatistics,
  };
};

const getModalWidth = (screenWidth: number) =>
  Math.min(screenWidth - 32, screenWidth >= 1024 ? 960 : 420);

type QuickActionAnimations = ReturnType<typeof useMatchQuickActionsAnimations>;

const getScoreControlValues = (
  match: TrackedMatch | null,
  liveMatchData: LiveMatch | undefined,
  isApiControlledMatch: boolean,
  animations: QuickActionAnimations,
  handleGoalIncrement: MatchQuickActionsModalProps["handleGoalIncrement"],
  handleGoalDecrement: MatchQuickActionsModalProps["handleGoalDecrement"],
  disabled: boolean,
): ScoreControlValues | null => {
  if (!match) return null;
  return {
    matchId: match.id,
    homeGoals: match.homeGoals ?? 0,
    awayGoals: match.awayGoals ?? 0,
    isApiControlledMatch,
    liveHomeScore: liveMatchData?.homeScore ?? match.homeGoals ?? 0,
    liveAwayScore: liveMatchData?.awayScore ?? match.awayGoals ?? 0,
    goalValueAnimHome: animations.goalValueAnimHome,
    goalValueAnimAway: animations.goalValueAnimAway,
    incrementAnimHome: animations.incrementAnimHome,
    decrementAnimHome: animations.decrementAnimHome,
    incrementAnimAway: animations.incrementAnimAway,
    decrementAnimAway: animations.decrementAnimAway,
    animateButtonPress: animations.animateButtonPress,
    handleGoalIncrement,
    handleGoalDecrement,
    disabled,
  };
};

interface MatchQuickActionsModalViewProps {
  isVisible: boolean;
  onClose: () => void;
  match: TrackedMatch | null;
  homeTeamLogo: ReturnType<typeof useTeamLogo>;
  awayTeamLogo: ReturnType<typeof useTeamLogo>;
  isCommonMatch: boolean;
  showStatisticsTab: boolean;
  scoreControls: ScoreControlValues | null;
  isApiControlledMatch: boolean;
  goalScorers: GoalScorerValues;
  players: PlayerValues;
  statistics: MatchTabContentProps["statistics"];
  animations: QuickActionAnimations;
  styles: ReturnType<typeof createStyles>;
}

const MatchQuickActionsModalView = ({
  isVisible,
  onClose,
  match,
  homeTeamLogo,
  awayTeamLogo,
  isCommonMatch,
  showStatisticsTab,
  scoreControls,
  isApiControlledMatch,
  goalScorers,
  players,
  statistics,
  animations,
  styles,
}: MatchQuickActionsModalViewProps) => {
  const [activeTab, setActiveTab] = useState("overview");
  if (!match || !isVisible || !scoreControls) return null;

  return (
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
                opacity: animations.modalContentAnim,
                transform: [
                  {
                    scale: animations.modalContentAnim.interpolate({
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
              onPress={(event) => event.stopPropagation()}
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

                <MatchTabContent
                  activeTab={activeTab}
                  scoreControls={scoreControls}
                  isApiControlledMatch={isApiControlledMatch}
                  goalScorers={goalScorers}
                  players={players}
                  statistics={statistics}
                  styles={styles}
                />

                <Animated.View
                  style={{
                    transform: [{ scale: animations.closeButtonAnim }],
                    width: "100%",
                  }}
                >
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      animations.animateButtonPress(animations.closeButtonAnim);
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
  );
};

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
  disabled = false,
}) => {
  const colors = useThemed();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWideLayout = screenWidth >= 1024;
  const playerColumnCount = getPlayerColumnCount(screenWidth);

  const modalWidth = getModalWidth(screenWidth);
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
  /** Selected match entity (or null). */
  const match = useMemo(
    () => findSelectedMatch(matches, selectedMatchId),
    [selectedMatchId, matches],
  );

  // Get team logos with async fallback support
  const homeTeamLogo = useTeamLogo(match?.homeTeam || "");
  const awayTeamLogo = useTeamLogo(match?.awayTeam || "");

  /** Live data for selected match (if present). */
  const liveMatchData = useMemo(
    () => findLiveMatch(liveMatches, selectedMatchId),
    [liveMatches, selectedMatchId],
  );

  /** Whether scores are driven by live API (read-only). */
  // Multiplayer snapshots carry provider provenance even before a live poll;
  // solo games retain the legacy live-data check.
  const isApiControlledMatch = isProviderControlledMatch(match, liveMatchData);

  /** Goal scorers array for home team (live data). */
  const homeTeamScorers = useMemo(
    () => getTeamScorers(liveMatchData, "home"),
    [liveMatchData],
  );

  /** Goal scorers array for away team (live data). */
  const awayTeamScorers = useMemo(
    () => getTeamScorers(liveMatchData, "away"),
    [liveMatchData],
  );

  const animations = useMatchQuickActionsAnimations({
    isVisible,
    match,
    liveMatchData,
    isApiControlledMatch,
  });

  /** Players impacted by this match (assigned or common). */
  const affectedPlayers = useMemo(
    () =>
      getAffectedPlayers(match, players, commonMatchId, playerAssignments),
    [match, players, commonMatchId, playerAssignments],
  );

  const isCommonMatch = isCommonMatchSelection(match, commonMatchId);

  /**
   * Distribute affected players into three columns for display.
   * @returns {Player[][]} 2D array; each sub-array is a column of players.
   */
  const playerColumns = useMemo(
    () => distributePlayers(affectedPlayers, playerColumnCount),
    [affectedPlayers, playerColumnCount],
  );

  const showStatisticsTab = shouldShowStatisticsTab(
    isApiControlledMatch,
    liveMatchData,
  );
  const statistics = getMatchStatistics(isApiControlledMatch, liveMatchData);
  const scoreControls = getScoreControlValues(
    match,
    liveMatchData,
    isApiControlledMatch,
    animations,
    handleGoalIncrement,
    handleGoalDecrement,
    disabled,
  );

  return (
    <MatchQuickActionsModalView
      isVisible={isVisible}
      onClose={onClose}
      match={match}
      homeTeamLogo={homeTeamLogo}
      awayTeamLogo={awayTeamLogo}
      isCommonMatch={isCommonMatch}
      showStatisticsTab={showStatisticsTab}
      scoreControls={scoreControls}
      isApiControlledMatch={isApiControlledMatch}
      goalScorers={{ homeTeamScorers, awayTeamScorers }}
      players={{
        affectedPlayersCount: affectedPlayers.length,
        playerColumns,
        modalContentAnim: animations.modalContentAnim,
      }}
      statistics={statistics}
      animations={animations}
      styles={styles}
    />
  );
};

export default MatchQuickActionsModal;
