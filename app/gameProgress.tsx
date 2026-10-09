/**
 * @file gameProgress.tsx
 * @description Main in-game screen shell: renders tabs, footer, and modals using the game progress controller hook.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";

import EndGameModal from "../components/gameProgress/EndGameModal";
import { SuccessorChooserModal } from "../components/lobby/SuccessorChooserModal";
import { ShellActionButton, ShellScreen } from "../components/ui";
import FooterButtons from "../components/gameProgress/FooterButtons";
import { MultiplayerGameStatus } from "../components/gameProgress/MultiplayerGameStatus";
import { ReassignmentControl } from "../components/gameProgress/ReassignmentControl";
import MatchesGrid from "../components/gameProgress/MatchesGrid/";
import MatchQuickActionsModal from "../components/gameProgress/MatchQuickActionsModal";
import PlayersList from "../components/gameProgress/PlayersList";
import TabNavigation from "../components/gameProgress/TabNavigation";
import useGameProgressController from "../hooks/useGameProgressController";
import { useGuestRoomSession } from "../hooks/useGuestRoomSession";
import { useRoomExit } from "../hooks/useRoomExit";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
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

  const departure = useGameDeparture(activeGame);
  const { departurePending, canLeave, setLeaveConfirmVisible } = departure;
  const controlsDisabled = activeGame.isMultiplayer && (!activeGame.isEditable || departurePending);

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
              disabled={!activeGame.isEditable || departurePending}
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
                disabled={controlsDisabled}
              />
            </View>
          </TabNavigation>

          <View style={styles.footerContainer}>
            <FooterButtons
              onHome={handleGoHome}
              onBackToSetup={handleBackToSetup}
              onEndGame={handleEndGame}
              onLeaveGame={() => setLeaveConfirmVisible(true)}
              showLeaveGame={canLeave}
              showEndGame={
                !departurePending && (!activeGame.isMultiplayer ||
                (activeGame.isHost && activeGame.isEditable)
                )
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
        disabled={controlsDisabled}
      />

      <EndGameModal
        isVisible={isAlertVisible}
        onCancel={cancelEndGame}
        onConfirm={confirmEndGame}
      />

      <GameDepartureModals departure={departure} isHost={activeGame.isHost} />
    </SafeAreaView>
  );
};

function useGameDeparture(activeGame: NonNullable<ReturnType<typeof useGameProgressController>["activeGame"]>) {
  const router = useRouter();
  const context = useGameStore((state) => state.activeGameContext);
  const resetState = useGameStore((state) => state.resetState);
  const guestRoom = useGuestRoomSession();
  const exit = useRoomExit();
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const leaveFinishedRef = useRef(false);
  const finishLeave = useCallback(() => {
    if (leaveFinishedRef.current) return;
    leaveFinishedRef.current = true;
    resetState();
    router.replace("/");
  }, [resetState, router]);

  useEffect(() => {
    if (leaving && context.accessKind === "guest" && guestRoom.status === "left") {
      finishLeave();
    }
  }, [context.accessKind, finishLeave, guestRoom.status, leaving]);

  const confirmLeave = useCallback(async () => {
    if (!context.sessionId || leaving) return;
    setLeaving(true);
    setLeaveError(null);
    if (context.accessKind === "guest") {
      if (await guestRoom.leaveRoom()) finishLeave();
      else {
        setLeaveError("Departure has not been confirmed. It will retry while you are connected.");
        setLeaving(false);
      }
      return;
    }
    const result = await exit.exitRoom(context.sessionId, activeGame.isHost ? "owner" : "member");
    setLeaving(false);
    if (result) finishLeave();
  }, [activeGame.isHost, context.accessKind, context.sessionId, exit, finishLeave, guestRoom, leaving]);

  const chooseSuccessor = useCallback(async (participantId: string) => {
    if (!context.sessionId) return;
    const result = await exit.confirmSuccessor(context.sessionId, participantId);
    if (result) finishLeave();
  }, [context.sessionId, exit, finishLeave]);

  const confirmClose = useCallback(async () => {
    if (!context.sessionId) return;
    const result = await exit.confirmClose(context.sessionId);
    if (result) finishLeave();
  }, [context.sessionId, exit, finishLeave]);

  const departurePending = leaving || (context.accessKind === "guest"
    && guestRoom.status === "pending_leave");
  const canLeave = activeGame.isMultiplayer && activeGame.isEditable
    && Boolean(context.sessionId && context.participantId) && !departurePending;

  return { leaveConfirmVisible, setLeaveConfirmVisible, leaving, leaveError, guestRoom, exit, confirmLeave, chooseSuccessor, confirmClose, departurePending, canLeave };
}

function GameDepartureModals({ departure, isHost }: { departure: ReturnType<typeof useGameDeparture>; isHost: boolean }) {
  const {
    leaveConfirmVisible,
    setLeaveConfirmVisible,
    leaving,
    leaveError,
    guestRoom,
    exit,
    confirmLeave,
    chooseSuccessor,
    confirmClose,
  } = departure;
  return (
    <>
    <Modal visible={leaveConfirmVisible && !exit.pendingSuccessorChoice && !exit.needsCloseConfirm}
      transparent animationType="fade"
      onRequestClose={() => { if (!leaving) setLeaveConfirmVisible(false); }}>
      <YStack flex={1} justifyContent="center" alignItems="center"
        backgroundColor="$backgroundModalOverlay" padding="$5">
        <YStack backgroundColor="$background" borderRadius="$6" gap="$3"
          padding="$5" width="100%" maxWidth={420} testID="game-leave-confirm">
          <Text color="$color" fontSize={20} fontWeight="700">Leave Game?</Text>
          <Text color="$colorMuted">
            {isHost
              ? "A signed-in player can take over. If none remains, the room closes."
              : "Your result is saved at departure. The game continues for everyone else."}
          </Text>
          {leaveError || exit.error || guestRoom.error ? (
            <Text color="$danger">{leaveError || exit.error || guestRoom.error}</Text>
          ) : null}
          <ShellActionButton variant="danger" label={leaving ? "Leaving…" : "Leave Game"}
            testID="game-leave-confirm-button" onPress={() => { void confirmLeave(); }}
            disabled={leaving || exit.isExiting} />
          {!leaving ? <ShellActionButton variant="surface" label="Cancel"
            testID="game-leave-cancel" onPress={() => setLeaveConfirmVisible(false)} /> : null}
        </YStack>
      </YStack>
    </Modal>

    <SuccessorChooserModal visible={exit.pendingSuccessorChoice}
      candidates={exit.eligibleSuccessors}
      onChoose={(id) => { void chooseSuccessor(id); }} onCancel={exit.cancel} />

    <Modal visible={exit.needsCloseConfirm} transparent animationType="fade"
      onRequestClose={exit.cancel}>
      <YStack flex={1} justifyContent="center" alignItems="center"
        backgroundColor="$backgroundModalOverlay" padding="$5">
        <YStack backgroundColor="$background" borderRadius="$6" gap="$3"
          padding="$5" width="100%" maxWidth={420} testID="game-close-confirm">
          <Text color="$color" fontSize={20} fontWeight="700">Close the room?</Text>
          <Text color="$colorMuted">No signed-in player can take over. Leaving closes the room for everyone.</Text>
          <ShellActionButton variant="danger" label="Close Room"
            onPress={() => { void confirmClose(); }} />
          <ShellActionButton variant="surface" label="Cancel" onPress={exit.cancel} />
        </YStack>
      </YStack>
    </Modal>
    </>
  );
}

export default GameProgressScreen;
