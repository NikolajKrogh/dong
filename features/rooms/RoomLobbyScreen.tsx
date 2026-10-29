import { RoomLobbyDialogs } from "./RoomLobbyDialogs";
import { LobbyAssignmentController, RoomLobbyExit, RoomLobbyWizard } from "./RoomLobbyWizard";
import { RoomLobbyConfigure, RoomLobbyState, useLobbyAssignmentController } from "./useLobbyAssignmentController";
import { useLobbyGameplayHydration } from "./useLobbyGameplayHydration";
/**
 * @file RoomLobbyScreen.tsx
 * @description Live room lobby for the host and registered members. Polls the durable
 * room snapshot (~4s, no realtime), shows the roster, the host-only join code, and a
 * Leave action that runs ownership handover/closure for the host or a plain leave for a
 * member. The host can also select matches, designate a Common Match, tune the
 * per-player and shared-per-pair assignment counts, and start the game — the server
 * generates the canonical assignment set at start (specs/020-canonical-assignment-generation);
 * clients never compute assignments themselves. Every connected device auto-hydrates the
 * gameplay store and redirects to /gameProgress once the room transitions to
 * `in_progress`. Closed/expired rooms return the viewer home.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useState
} from "react";
import { Platform, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Text, YStack } from "tamagui";

import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useGameStore } from "../../store/gameStore";
import { isWideLayout } from "../../styles/responsive";
import type { BatchRoomMatchResult } from "../../types/room";
import { buildAccountAuthRoute, useAccountAuth } from "../account";
import { ParticipantList } from "./ParticipantList";
import { RoomEndedNotice } from "./RoomEndedNotice";
import { useMyActiveRoom } from "./useMyActiveRoom";
import { useRoomConfigure } from "./useRoomConfigure";
import { useRoomExit } from "./useRoomExit";
import { useRoomLobby } from "./useRoomLobby";
import { useRoomMatchPool } from "./useRoomMatchPool";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
type LobbyAuthRoute = "/auth" | "/auth/onboarding" | "/auth/change-password";

const RoomLobbyScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = normalizeParam(params.sessionId);
  const { status, account } = useAccountAuth();
  const membership = useMyActiveRoom(status === "ready" ? account?.id ?? null : null);

  if (status === "ready" && membership.activeRoom?.sessionId === sessionId) {
    return <RoomLobbyContent key={`${account?.id}:${sessionId}:${membership.activeRoom.participantId}`}
      sessionId={sessionId} participantId={membership.activeRoom.participantId} />;
  }

  return (
    <LobbyMembershipFallback
      sessionId={sessionId}
      status={status}
      membership={membership}
      router={router}
    />
  );
};

function LobbyMembershipFallback({
  sessionId,
  status,
  membership,
  router,
}: {
  sessionId: string;
  status: ReturnType<typeof useAccountAuth>["status"];
  membership: ReturnType<typeof useMyActiveRoom>;
  router: ReturnType<typeof useRouter>;
}) {
  const loading = status === "loading" || (status === "ready" && membership.isLoading);
  const requiresAuth = status !== "ready" && !loading;
  const returnTo = `/lobby/${encodeURIComponent(sessionId)}`;
  const authRoute = status === "needsUsername" ? "/auth/onboarding"
    : status === "recoveringPassword" ? "/auth/change-password" : "/auth";
  return (
    <ShellScreen centerContent>
      <YStack gap="$4" padding="$4">
        <LobbyMembershipMessage
          loading={loading}
          requiresAuth={requiresAuth}
          error={membership.error}
        />
        <LobbyMembershipActions
          loading={loading}
          requiresAuth={requiresAuth}
          error={membership.error}
          authRoute={authRoute}
          returnTo={returnTo}
          refresh={membership.refresh}
          router={router}
        />
      </YStack>
    </ShellScreen>
  );
}

function LobbyMembershipMessage({
  loading,
  requiresAuth,
  error,
}: {
  loading: boolean;
  requiresAuth: boolean;
  error: string | null;
}) {
  const copy = getLobbyMembershipCopy(loading, requiresAuth, error);

  return (
    <>
      <Text accessibilityRole="header">{copy.title}</Text>
      {copy.description ? <Text>{copy.description}</Text> : null}
    </>
  );
}

function getLobbyMembershipCopy(
  loading: boolean,
  requiresAuth: boolean,
  error: string | null,
): { title: string; description: string | null } {
  if (loading) return { title: "Loading your room…", description: null };
  if (requiresAuth) {
    return {
      title: "Sign in to return to your room",
      description: "Use the account you joined with. Guests can join from Home using the room code.",
    };
  }
  if (error) return { title: "Unable to load your room", description: error };
  return {
    title: "You are not an active member of this room",
    description: "This room may have ended. Join from Home using its room code.",
  };
}

function LobbyMembershipActions({
  loading,
  requiresAuth,
  error,
  authRoute,
  returnTo,
  refresh,
  router,
}: {
  loading: boolean;
  requiresAuth: boolean;
  error: string | null;
  authRoute: LobbyAuthRoute;
  returnTo: string;
  refresh: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
}) {
  const handleContinue = useCallback(() => {
    router.push(buildAccountAuthRoute(authRoute, returnTo) as never);
  }, [authRoute, returnTo, router]);
  const handleRetry = useCallback(() => {
    void refresh();
  }, [refresh]);
  const handleGoHome = useCallback(() => {
    router.replace("/");
  }, [router]);

  return (
    <>
      {requiresAuth ? <ShellActionButton label="Continue" onPress={handleContinue} /> : null}
      {error ? <ShellActionButton label="Retry" onPress={handleRetry} /> : null}
      {!loading ? <ShellActionButton label="Go Home" variant="secondary" onPress={handleGoHome} /> : null}
    </>
  );
}

const RoomLobbyContent = ({ sessionId, participantId }: { sessionId: string; participantId: string }) => {
  const router = useRouter();

  const lobby = useRoomLobby(sessionId || null, participantId);
  const exit = useRoomExit();
  const configure = useRoomConfigure(lobby.snapshot, lobby.refresh);
  useLobbyGameplayHydration(lobby, participantId, router);

  const { width } = useWindowDimensions();
  const wideLayout = isWideLayout(width);

  // useCallback because it feeds useRoomMatchPool's `setMatches` dependency
  // array and this screen re-renders on every ~4s poll.
  const handleBatchAdded = useCallback(
    ({ added, skipped }: BatchRoomMatchResult) => {
      // A repeat fixture is skipped rather than failed, so without this the host
      // would select ten, see eight land, and have no idea why.
      if (skipped > 0) {
        Toast.show({
          type: "themedWarning",
          text1: `Added ${added}`,
          text2: `${skipped} already in this room.`,
          position: "bottom",
        });
      }
    },
    [],
  );

  const pool = useRoomMatchPool({
    roomMatches: lobby.snapshot?.matches ?? [],
    addMatches: configure.addMatches,
    removeMatch: configure.removeMatch,
    removeMatches: configure.removeMatches,
    onBatchAdded: handleBatchAdded,
  });
  const assignment = useLobbyAssignmentController(lobby, configure, participantId);

  const clearActiveGameContext = useGameStore(
    (state) => state.clearActiveGameContext,
  );

  const goHome = useCallback(() => {
    clearActiveGameContext?.();
    router.replace("/");
  }, [clearActiveGameContext, router]);

  const navigateHome = useCallback(() => {
    router.dismissTo("/");
  }, [router]);

  const [isEndGameConfirmVisible, setIsEndGameConfirmVisible] = useState(false);

  const handleReturnToGame = useCallback(() => {
    router.dismissTo("/gameProgress");
  }, [router]);

  const handleLeave = useCallback(async () => {
    if (!sessionId || !lobby.myRole) {
      return;
    }
    const result = await exit.exitRoom(sessionId, lobby.myRole);
    // A resolved member-leave / transfer / close returns us home; a pending
    // successor choice or close-confirm keeps us here until the host decides.
    if (result) {
      goHome();
    }
  }, [exit, goHome, lobby.myRole, sessionId]);

  const handleEndGame = useCallback(async () => {
    const ended = await configure.endGame();
    setIsEndGameConfirmVisible(false);
    if (ended) {
      // The room is `completed` now, so the next poll flips roomEnded and this
      // screen becomes the ended notice; going home also drops the stale
      // "Return to room" affordance on Home, which reads the active room.
      goHome();
    }
  }, [configure, goHome]);

  const handleChooseSuccessor = useCallback(
    async (id: string) => {
      const result = await exit.confirmSuccessor(sessionId, id);
      if (result) {
        goHome();
      }
    },
    [exit, goHome, sessionId],
  );

  const handleConfirmClose = useCallback(async () => {
    const result = await exit.confirmClose(sessionId);
    if (result) {
      goHome();
    }
  }, [exit, goHome, sessionId]);

  const isHost = lobby.myRole === "owner";
  const handleOpenEndGameConfirmation = useCallback(() => {
    setIsEndGameConfirmVisible(true);
  }, []);
  const handleCloseEndGameConfirmation = useCallback(() => {
    setIsEndGameConfirmVisible(false);
  }, []);
  const refreshLobby = lobby.refresh;
  const handleRetryLobby = useCallback(() => {
    void refreshLobby();
  }, [refreshLobby]);
  const isPreStart = !lobby.roomEnded && !lobby.gameStarted;

  if (!lobby.snapshot) {
    return (
      <LobbyLoadingScreen
        error={lobby.error}
        onRetry={handleRetryLobby}
        onHome={navigateHome}
      />
    );
  }

  return (
    <ShellScreen
      padded={!isPreStart}
      centerContent={isPreStart && wideLayout}
      contentMaxWidth={isPreStart && wideLayout ? 1120 : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {lobby.error && (
          <YStack padding="$3" gap="$2">
            <Text>Connection interrupted. Room information may be out of date.</Text>
            <ShellActionButton label="Retry" onPress={handleRetryLobby} />
          </YStack>
        )}
        {isPreStart ? (
          <RoomLobbyWizard
            lobby={lobby}
            snapshot={lobby.snapshot}
            exit={exit}
            configure={configure}
            pool={pool}
            assignment={assignment}
            isHost={isHost}
            onLeave={handleLeave}
          />
        ) : (
          <LobbyPostStartContent
            lobby={lobby}
            exit={exit}
            configure={configure}
            assignment={assignment}
            isHost={isHost}
            onReturnHome={lobby.roomEnded ? goHome : navigateHome}
            onReturnToGame={handleReturnToGame}
            onLeave={handleLeave}
            onOpenEndGameConfirmation={handleOpenEndGameConfirmation}
          />
        )}
        <RoomLobbyDialogs
          assignment={assignment}
          configure={configure}
          exit={exit}
          isEndGameConfirmVisible={isEndGameConfirmVisible}
          onCloseEndGameConfirmation={handleCloseEndGameConfirmation}
          onEndGame={handleEndGame}
          onChooseSuccessor={handleChooseSuccessor}
          onConfirmClose={handleConfirmClose}
        />
      </SafeAreaView>
    </ShellScreen>
  );
};

function LobbyLoadingScreen({
  error,
  onRetry,
  onHome,
}: {
  error: string | null;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <ShellScreen centerContent>
      <YStack gap="$4" padding="$4">
        <Text>{error ? "Unable to load the room. Check your connection and try again." : "Loading room…"}</Text>
        {error && <ShellActionButton label="Retry" onPress={onRetry} />}
        <ShellActionButton label="Go Home" variant="secondary" onPress={onHome} />
      </YStack>
    </ShellScreen>
  );
}

function LobbyPostStartContent({
  lobby,
  exit,
  configure,
  assignment,
  isHost,
  onReturnHome,
  onReturnToGame,
  onLeave,
  onOpenEndGameConfirmation,
}: {
  lobby: RoomLobbyState;
  exit: RoomLobbyExit;
  configure: RoomLobbyConfigure;
  assignment: LobbyAssignmentController;
  isHost: boolean;
  onReturnHome: () => void;
  onReturnToGame: () => void;
  onLeave: () => void;
  onOpenEndGameConfirmation: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <YStack flex={1} gap="$5" paddingVertical="$4">
        <LobbyPostStartState
          lobby={lobby}
          exit={exit}
          configure={configure}
          assignment={assignment}
          isHost={isHost}
          onReturnHome={onReturnHome}
          onReturnToGame={onReturnToGame}
          onLeave={onLeave}
          onOpenEndGameConfirmation={onOpenEndGameConfirmation}
        />
      </YStack>
    </ScrollView>
  );
}

function LobbyPostStartState({
  lobby,
  exit,
  configure,
  assignment,
  isHost,
  onReturnHome,
  onReturnToGame,
  onLeave,
  onOpenEndGameConfirmation,
}: {
  lobby: RoomLobbyState;
  exit: RoomLobbyExit;
  configure: RoomLobbyConfigure;
  assignment: LobbyAssignmentController;
  isHost: boolean;
  onReturnHome: () => void;
  onReturnToGame: () => void;
  onLeave: () => void;
  onOpenEndGameConfirmation: () => void;
}) {
  if (lobby.roomEnded) {
    return <RoomEndedNotice onReturnHome={onReturnHome} />;
  }
  if (!lobby.gameStarted) return null;

  return (
    <YStack gap="$4" testID="lobby-in-progress">
      <Text {...(Platform.OS === "web" ? { role: "heading", "aria-level": 1 } : { accessibilityRole: "header" })} color="$color" fontSize={28} fontWeight="700">
        Game in progress
      </Text>
      <Text color="$colorMuted" fontSize={14}>
        {isHost
          ? "Ending the game finishes it for everyone and saves it to the room's history."
          : "Leaving takes you out of the room; the game carries on for everyone else."}
      </Text>
      <ParticipantList
        participants={lobby.participants}
        pickProgress={assignment.pickProgress}
      />
      <ShellActionButton label="Home" variant="surface" testID="lobby-home" onPress={onReturnHome} />
      <LobbyInProgressActions
        isHost={isHost}
        isBusy={configure.isBusy}
        isExiting={exit.isExiting}
        onReturnToGame={onReturnToGame}
        onLeave={onLeave}
        onOpenEndGameConfirmation={onOpenEndGameConfirmation}
      />
      <LobbyInProgressErrors configureError={configure.error} exitError={exit.error} />
    </YStack>
  );
}

function LobbyInProgressActions({
  isHost,
  isBusy,
  isExiting,
  onReturnToGame,
  onLeave,
  onOpenEndGameConfirmation,
}: {
  isHost: boolean;
  isBusy: boolean;
  isExiting: boolean;
  onReturnToGame: () => void;
  onLeave: () => void;
  onOpenEndGameConfirmation: () => void;
}) {
  return (
    <>
      <ShellActionButton
        variant="primary"
        label="Return to game"
        testID="lobby-return-to-game"
        onPress={onReturnToGame}
      />
      {isHost ? (
        <ShellActionButton
          variant="danger"
          label="End game for everyone"
          testID="lobby-end-game"
          disabled={isBusy}
          onPress={onOpenEndGameConfirmation}
        />
      ) : null}
      <ShellActionButton
        variant="surface"
        label={isHost ? "Leave Room" : "Leave"}
        testID="lobby-in-progress-leave"
        disabled={isExiting}
        onPress={onLeave}
      />
    </>
  );
}

function LobbyInProgressErrors({
  configureError,
  exitError,
}: {
  configureError: string | null;
  exitError: string | null;
}) {
  return (
    <>
      {configureError ? (
        <Text color="$danger" fontSize={13} testID="lobby-in-progress-error">
          {configureError}
        </Text>
      ) : null}
      {exitError ? (
        <Text color="$danger" fontSize={13}>
          {exitError}
        </Text>
      ) : null}
    </>
  );
}

export default RoomLobbyScreen;
