import React, { useState } from "react";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Text, View } from "react-native";

import AppIcon from "../../components/ui/AppIcon";
import { ShellActionButton } from "../../components/ui";
import { CancelGameModal } from "./CancelGameModal";
import { CurrentGameCard } from "./CurrentGameCard";
import { StartGameSheet } from "./StartGameSheet";
import { useHomeRoomActions } from "./useHomeRoomActions";
import { useGameStore } from "../../store/gameStore";
import createStyles from "./homeStyles";
import { useColors } from "../../styles/theme";
import { buildAccountAuthRoute } from "../account/accountAuthRoutes";
import { endSoloTracking } from "../football-matches/soloTrackingService";

interface HomeGameActionsProps {
  actions: ReturnType<typeof useHomeRoomActions>;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  wideLayout: boolean;
}

interface CurrentGameDetails {
  title: string;
  matchesCount: number | undefined;
  playersCount: number | undefined;
  cancelLabel: string;
  continueHref: Href | undefined;
}

export function HomeGameActions({ actions: roomActions, colors, styles, wideLayout }: HomeGameActionsProps): React.ReactElement {
  const router = useRouter();
  const game = useGameStore();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isStartSheetVisible, setIsStartSheetVisible] = useState(false);
  const { activeRoom, guestRoomSession } = roomActions;
  const currentGame = getCurrentGameDetails(roomActions, game);
  const openCancelModal = () => setIsConfirmModalVisible(true);
  const continueGame = () => {
    if (activeRoom) {
      roomActions.handleReturnToRoom();
    } else if (guestRoomSession && guestRoomSession.snapshot.state !== "in_progress") {
      roomActions.handleOpenGuestJoin();
    } else {
      router.push("/gameProgress");
    }
  };
  const openExit = activeRoom ? roomActions.openRoomExit : openCancelModal;

  const handleCancelGame = () => {
    if (guestRoomSession) {
      setIsConfirmModalVisible(false);
      void roomActions.handleLeaveGuestJoin();
      return;
    }
    if (game.activeGameContext?.mode === "multiplayer") return;
    game.resetState();
    void endSoloTracking();
    setIsConfirmModalVisible(false);
  };

  return <>
    {currentGame ? (
      <CurrentGameCard
        colors={colors}
        styles={styles}
        {...currentGame}
        disabled={roomActions.isActiveRoomLoading || roomActions.exit.isExiting}
        onContinue={continueGame}
        onCancel={openExit}
      />
    ) : (
      <ShellActionButton
        variant="success"
        label="Start New Game"
        testID="home-start-game-button"
        icon={<AppIcon name="add-circle" size={22} color={colors.white} />}
        onPress={() => setIsStartSheetVisible(true)}
        disabled={roomActions.isActiveRoomLoading || Boolean(roomActions.activeRoomError)}
        widthMode={wideLayout ? "wide" : undefined}
        style={{ marginTop: 16 }}
      />
    )}
    {roomActions.activeRoomError ? <View>
      <Text accessibilityRole="alert" style={styles.createRoomError}>{roomActions.activeRoomError}</Text>
      <ShellActionButton variant="surface" label="Retry" onPress={() => { void roomActions.refreshActiveRoom(); }} />
    </View> : null}
    {roomActions.guestRoomError ? <View>
      <Text accessibilityRole="alert" style={styles.createRoomError}>{roomActions.guestRoomError}</Text>
      <ShellActionButton variant="surface" label="Review room" onPress={roomActions.handleOpenGuestJoin} />
    </View> : null}
    <StartGameSheet
      visible={isStartSheetVisible}
      busy={roomActions.isCreatingRoom}
      error={roomActions.createRoomError}
      signedIn={roomActions.account !== null}
      onClose={() => setIsStartSheetVisible(false)}
      onLocal={() => {
        setIsStartSheetVisible(false);
        router.push("/setupGame");
      }}
      onHost={() => {
        if (!roomActions.account) {
          setIsStartSheetVisible(false);
          router.push(buildAccountAuthRoute("/auth", "/") as never);
          return;
        }
        void roomActions.createRoom().then(created => {
          if (created) setIsStartSheetVisible(false);
        });
      }}
      onJoin={() => {
        setIsStartSheetVisible(false);
        if (roomActions.account) roomActions.setIsJoinModalVisible(true);
        else roomActions.handleOpenGuestJoin();
      }}
    />
    <CancelGameModal
      visible={isConfirmModalVisible}
      title={guestRoomSession ? "Leave Room" : undefined}
      message={guestRoomSession ? "Leave this room? The other players can continue playing." : undefined}
      confirmLabel={guestRoomSession ? "Leave Room" : undefined}
      styles={styles}
      onRequestClose={() => setIsConfirmModalVisible(false)}
      onConfirm={handleCancelGame}
    />
  </>;
}

function getCurrentGameDetails(
  actions: ReturnType<typeof useHomeRoomActions>,
  game: ReturnType<typeof useGameStore.getState>,
): CurrentGameDetails | null {
  if (actions.activeRoom || actions.guestRoomSession) {
    const snapshot = actions.activeRoom ? actions.activeRoomSnapshot : actions.guestRoomSession?.snapshot;
    const roster = snapshot?.activeRoster ?? snapshot?.participants;
    return {
      title: snapshot?.state === "in_progress" ? "Current Game in Progress" : "Current Room",
      matchesCount: snapshot?.matches.length,
      playersCount: roster?.filter(player => !player.leftAt).length,
      cancelLabel: "Leave Room",
      continueHref: undefined,
    };
  }
  if (game.activeGameContext?.mode === "multiplayer" || !game.players.length || !game.matches.length) return null;
  return {
    title: "Current Game in Progress",
    matchesCount: game.matches.length,
    playersCount: game.players.length,
    cancelLabel: "Cancel Game",
    continueHref: "/gameProgress" as const,
  };
}
