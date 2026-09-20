/**
 * @file gameProgress.tsx
 * @description Main in-game screen shell: renders tabs, footer, and modals using the game progress controller hook.
 */
import React from "react";
import { RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EndGameModal from "../components/gameProgress/EndGameModal";
import FooterButtons from "../components/gameProgress/FooterButtons";
import { MultiplayerGameStatus } from "../components/gameProgress/MultiplayerGameStatus";
import { ReassignmentControl } from "../components/gameProgress/ReassignmentControl";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import PlayersList from "../components/gameProgress/PlayersList";
import TabNavigation from "../components/gameProgress/TabNavigation";
import { ShellScreen } from "../components/ui";
import useGameProgressController from "../hooks/useGameProgressController";
import { isWideLayout } from "../styles/responsive";

const GameProgressScreen = () => {
  const { width } = useWindowDimensions();
  const wideLayout = isWideLayout(width);
  const {
    colors,
    styles,
    activeTab,
    isAlertVisible,
    selectedMatchId,
    isQuickActionsVisible,
    refreshing,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    liveMatches,
    isPolling,
    lastUpdated,
    setActiveTab,
    openQuickActions,
    closeQuickActions,
    onRefresh,
    handleDrinkIncrement,
    handleDrinkDecrement,
    handleBackToSetup,
    handleGoHome,
    handleEndGame,
    handleGoalIncrement,
    handleGoalDecrement,
    cancelEndGame,
    confirmEndGame,
    activeGame: activeGameFromController,
  } = useGameProgressController();
  // Keep the route resilient to older test harnesses and persisted solo state
  // that predate the multiplayer controller return value.
  const activeGame =
    activeGameFromController ??
    ({
      isMultiplayer: false,
      isHost: false,
      isEditable: false,
      status: "idle",
      error: null,
      snapshot: null,
      ownerParticipantId: null,
      participantId: null,
      pendingMutations: [],
      lastAppliedSequence: 0,
      refresh: async () => null,
      changeManualScore: async () => undefined,
      changeParticipantDrink: async () => undefined,
      retryMutation: async () => null,
      completeGame: async () => null,
      reassignParticipantMatches: async () => {
        throw new Error("Multiplayer game context is unavailable.");
      },
    } as NonNullable<typeof activeGameFromController>);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShellScreen
        padded={false}
        centerContent={wideLayout}
        contentMaxWidth={wideLayout ? 1280 : undefined}
      >
        <View style={styles.container}>
          <MultiplayerGameStatus
            status={activeGame.status}
            error={activeGame.error}
            pendingMutations={activeGame.pendingMutations}
            onRefresh={() => void activeGame.refresh()}
            onRetryMutation={(id) => void activeGame.retryMutation(id)}
          />
          {activeGame.isHost && activeGame.snapshot?.state === "in_progress" ? (
            <ReassignmentControl
              snapshot={activeGame.snapshot}
              pending={activeGame.status === "refreshing"}
              disabled={!activeGame.isEditable}
              onReassign={activeGame.reassignParticipantMatches}
            />
          ) : null}
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            matchesCount={matches.length}
            playersCount={players.length}
          >
            <View style={styles.tabContent}>
              <MatchesGrid
                matches={matches}
                players={players}
                commonMatchId={commonMatchId}
                playerAssignments={playerAssignments}
                openQuickActions={openQuickActions}
                liveMatches={liveMatches}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                }
                onRefresh={onRefresh}
                refreshing={refreshing}
                lastUpdated={lastUpdated}
                isPolling={isPolling}
              />
            </View>

            <View style={styles.tabContent}>
              <PlayersList
                players={players}
                matches={matches}
                commonMatchId={commonMatchId}
                playerAssignments={playerAssignments}
                handleDrinkIncrement={handleDrinkIncrement}
                handleDrinkDecrement={handleDrinkDecrement}
                disabled={activeGame.isMultiplayer && !activeGame.isEditable}
              />
            </View>
          </TabNavigation>

          <View style={styles.footerContainer}>
            <FooterButtons
              onHome={handleGoHome}
              onBackToSetup={handleBackToSetup}
              onEndGame={handleEndGame}
              showEndGame={
                !activeGame.isMultiplayer ||
                (activeGame.isHost && activeGame.isEditable)
              }
            />
          </View>
        </View>
      </ShellScreen>

      <MatchQuickActionsModal
        isVisible={isQuickActionsVisible}
        onClose={closeQuickActions}
        selectedMatchId={selectedMatchId}
        matches={matches}
        players={players}
        commonMatchId={commonMatchId}
        playerAssignments={playerAssignments}
        handleGoalIncrement={handleGoalIncrement}
        handleGoalDecrement={handleGoalDecrement}
        liveMatches={liveMatches}
        disabled={activeGame.isMultiplayer && !activeGame.isEditable}
      />

      <EndGameModal
        isVisible={isAlertVisible}
        onCancel={cancelEndGame}
        onConfirm={confirmEndGame}
      />
    </SafeAreaView>
  );
};

export default GameProgressScreen;
