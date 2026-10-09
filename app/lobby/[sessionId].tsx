/**
 * @file lobby/[sessionId].tsx
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Text, YStack } from "tamagui";

import { CommonMatchSelector, MatchList, SetupWizard } from "../../components";
import type { WizardStep } from "../../components/setupGame/SetupWizard";
import {
  SelectableMatchList,
  type SelectableMatch,
} from "../../components/matchSelection/SelectableMatchList";
import { AssignmentModeSelector } from "../../components/lobby/AssignmentModeSelector";
import { ASSIGNMENT_MODE_LABELS } from "../../types/room";
import {
  AssignmentRequirementLine,
  AssignmentSettingsPanel,
} from "../../components/lobby/AssignmentSettingsPanel";
import { HostAllocationGrid } from "../../components/lobby/HostAllocationGrid";
import { ParticipantList } from "../../components/lobby/ParticipantList";
import { RoomIdentityPanel } from "../../components/lobby/RoomIdentityPanel";
import { StartGameWarnings } from "../../components/lobby/StartGameWarnings";
import { PlayerPickPanel } from "../../components/lobby/PlayerPickPanel";
import { RoomEndedNotice } from "../../components/lobby/RoomEndedNotice";
import { SuccessorChooserModal } from "../../components/lobby/SuccessorChooserModal";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useRoomConfigure } from "../../hooks/useRoomConfigure";
import { useRoomExit } from "../../hooks/useRoomExit";
import { useRoomLobby } from "../../hooks/useRoomLobby";
import { useAccountAuth } from "../../hooks/useAccountAuth";
import { useMyActiveRoom } from "../../hooks/useMyActiveRoom";
import { buildAccountAuthRoute } from "../../utils/accountAuthRoutes";
import { useRoomMatchPool } from "../../hooks/useRoomMatchPool";
import { useGameStore } from "../../store/store";
import {
  roomSnapshotToActiveRoster,
  roomSnapshotToGameState,
} from "../../utils/roomSnapshot";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import type { AssignmentMode, BatchRoomMatchResult } from "../../types/room";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
const noop = () => undefined;

type RoomLobbyState = ReturnType<typeof useRoomLobby>;
type RoomLobbySnapshot = NonNullable<RoomLobbyState["snapshot"]>;
type RoomLobbyConfigure = ReturnType<typeof useRoomConfigure>;
type RoomLobbyExit = ReturnType<typeof useRoomExit>;
type RoomLobbyPool = ReturnType<typeof useRoomMatchPool>;
type LobbyPlan = RoomLobbySnapshot["assignmentPlan"];
type LobbyPickProgress = Record<string, { picked: number; total: number }>;
type LobbyAuthRoute = "/auth" | "/auth/onboarding" | "/auth/change-password";

const EMPTY_ASSIGNMENT_PLAN: LobbyPlan = {
  participantCount: 0,
  poolSize: 0,
  matchesPerPlayer: 0,
  sharedMatchesPerPair: 0,
  effectivePerPlayer: 0,
  requiredPoolSize: 0,
  relaxedFloor: 0,
  feasible: false,
  startable: false,
};

function useLobbyAssignmentController(
  lobby: RoomLobbyState,
  configure: RoomLobbyConfigure,
  participantId: string,
) {
  const snapshot = lobby.snapshot;
  const [pendingModeSwitch, setPendingModeSwitch] = useState<AssignmentMode | null>(null);
  const plan = snapshot?.assignmentPlan ?? EMPTY_ASSIGNMENT_PLAN;
  const assignmentMode = snapshot?.assignmentMode ?? "automatic";
  const participants = useMemo(
    () => snapshot ? roomSnapshotToActiveRoster(snapshot) : [],
    [snapshot],
  );
  const assignments = useMemo(() => snapshot?.assignments ?? [], [snapshot?.assignments]);
  const commonMatchId = snapshot?.commonMatchId ?? null;

  const handleSelectMode = useCallback((mode: AssignmentMode) => {
    if (mode === assignmentMode) return;
    if ((snapshot?.assignments.length ?? 0) > 0) {
      setPendingModeSwitch(mode);
      return;
    }
    void configure.setAssignmentMode(mode);
  }, [assignmentMode, configure, snapshot?.assignments.length]);

  const handleConfirmModeSwitch = useCallback(() => {
    if (pendingModeSwitch) {
      void configure.setAssignmentMode(pendingModeSwitch);
    }
    setPendingModeSwitch(null);
  }, [configure, pendingModeSwitch]);
  const handleCancelModeSwitch = useCallback(() => setPendingModeSwitch(null), []);

  const automaticMinimum = plan.sharedMatchesPerPair * Math.max(participants.length - 1, 0);
  const modeSwitchRaisesMinimum = pendingModeSwitch === "automatic" &&
    automaticMinimum > plan.matchesPerPlayer;

  const picks = useMemo(() => snapshot?.picks ?? [], [snapshot?.picks]);
  const isPlayerPicked = assignmentMode === "player_picked";
  const canPick = isPlayerPicked && lobby.state === "joinable";
  const pickableMatches = useMemo<SelectableMatch[]>(
    () => (snapshot?.matches ?? [])
      .filter((match) => match.id !== commonMatchId)
      .map((match) => ({
        id: match.id,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        startTime: match.kickoffAt ?? undefined,
      })),
    [snapshot?.matches, commonMatchId],
  );
  const poolAsSelectable = useMemo<SelectableMatch[]>(
    () => (snapshot?.matches ?? []).map((match) => ({
      id: match.id,
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      startTime: match.kickoffAt ?? undefined,
    })),
    [snapshot?.matches],
  );
  const myPicks = useMemo(
    () => participantId
      ? picks.filter((pick) => pick.participantId === participantId)
        .map((pick) => pick.matchId)
      : [],
    [participantId, picks],
  );
  const pickProgress = useMemo<LobbyPickProgress | undefined>(() => {
    if (!isPlayerPicked) return undefined;
    return participants.reduce<LobbyPickProgress>((accumulator, participant) => {
      accumulator[participant.id] = {
        picked: picks.filter((pick) => pick.participantId === participant.id).length,
        total: plan.matchesPerPlayer,
      };
      return accumulator;
    }, {});
  }, [isPlayerPicked, participants, picks, plan.matchesPerPlayer]);

  const additionalMatchIdsFor = useCallback(
    (participantId: string) => assignments
      .filter((assignment) => assignment.participantId === participantId && assignment.matchId !== commonMatchId)
      .map((assignment) => assignment.matchId),
    [assignments, commonMatchId],
  );
  const shortParticipants = participants.filter(
    (participant) => additionalMatchIdsFor(participant.id).length < plan.matchesPerPlayer,
  );
  const toggleAllocation = useCallback((participantId: string, matchId: string) => {
    const activeAssignments = assignments.filter((assignment) =>
      participants.some((participant) => participant.id === assignment.participantId),
    );
    const exists = activeAssignments.some((assignment) =>
      assignment.participantId === participantId && assignment.matchId === matchId,
    );
    const next = exists
      ? activeAssignments.filter((assignment) =>
        assignment.participantId !== participantId || assignment.matchId !== matchId,
      )
      : [...activeAssignments, { participantId, matchId }];
    void configure.setAssignments(next);
  }, [assignments, configure, participants]);

  return {
    assignmentMode,
    automaticMinimum,
    canPick,
    commonMatchId,
    handleCancelModeSwitch,
    handleConfirmModeSwitch,
    handleSelectMode,
    modeSwitchRaisesMinimum,
    myPicks,
    participants,
    pendingModeSwitch,
    pickProgress,
    pickableMatches,
    plan,
    poolAsSelectable,
    shortParticipants,
    additionalMatchIdsFor,
    toggleAllocation,
  };
}

const LobbyScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = normalizeParam(params.sessionId);
  const { status, account } = useAccountAuth();
  const membership = useMyActiveRoom(status === "ready" ? account?.id ?? null : null);

  if (status === "ready" && membership.activeRoom?.sessionId === sessionId) {
    return <RoomLobbyScreen key={`${account?.id}:${sessionId}:${membership.activeRoom.participantId}`}
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

const RoomLobbyScreen = ({ sessionId, participantId }: { sessionId: string; participantId: string }) => {
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

  const [isEndGameConfirmVisible, setIsEndGameConfirmVisible] = useState(false);

  // push, not replace: the lobby stays on the stack so the game screen's back
  // gesture returns here rather than dropping the room entirely.
  const handleReturnToGame = useCallback(() => {
    router.push("/gameProgress");
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
        onHome={goHome}
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
            onReturnHome={goHome}
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
type LobbyAssignmentController = ReturnType<typeof useLobbyAssignmentController>;
type LobbyRouter = ReturnType<typeof useRouter>;

function useLobbyGameplayHydration(
  lobby: RoomLobbyState,
  participantId: string,
  router: LobbyRouter,
) {
  const hasHydratedGameplayRef = useRef(false);
  // Only a start observed after this mount began in the lobby should redirect.
  const seenPreStartRef = useRef(false);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const setMatches = useGameStore((state) => state.setMatches);
  const setCommonMatchId = useGameStore((state) => state.setCommonMatchId);
  const setPlayerAssignments = useGameStore((state) => state.setPlayerAssignments);
  const setActiveGameContext = useGameStore((state) => state.setActiveGameContext);

  useEffect(() => {
    if (lobby.snapshot && !lobby.gameStarted) seenPreStartRef.current = true;
  }, [lobby.gameStarted, lobby.snapshot]);

  useEffect(() => {
    const snapshot = lobby.snapshot;
    if (!lobby.gameStarted || !snapshot || hasHydratedGameplayRef.current) return;
    hasHydratedGameplayRef.current = true;
    const gameState = roomSnapshotToGameState(snapshot);
    setPlayers(gameState.players);
    setMatches(gameState.matches);
    setCommonMatchId(gameState.commonMatchId);
    setPlayerAssignments(gameState.playerAssignments);
    setActiveGameContext?.({
      mode: "multiplayer",
      sessionId: snapshot.sessionId,
      participantId,
      accessKind: "registered",
      lastAppliedSequence: snapshot.lastEventSequence ?? 0,
    });
    if (seenPreStartRef.current) router.replace("/gameProgress");
  }, [
    lobby.gameStarted,
    lobby.snapshot,
    participantId,
    router,
    setActiveGameContext,
    setCommonMatchId,
    setMatches,
    setPlayerAssignments,
    setPlayers,
  ]);
}

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

function RoomLobbyWizard({
  lobby,
  snapshot,
  exit,
  configure,
  pool,
  assignment,
  isHost,
  onLeave,
}: {
  lobby: RoomLobbyState;
  snapshot: RoomLobbySnapshot;
  exit: RoomLobbyExit;
  configure: RoomLobbyConfigure;
  pool: RoomLobbyPool;
  assignment: LobbyAssignmentController;
  isHost: boolean;
  onLeave: () => void;
}) {
  const colors = useColors();
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const startGame = configure.startGame;
  const handleStartGame = useCallback(() => void startGame(), [startGame]);
  const steps: WizardStep[] = [
    {
      key: "room",
      name: "Room",
      icon: "people",
      canEnter: true,
      content: <LobbyIdentityStepContent lobby={lobby} exit={exit} assignment={assignment} />,
    },
    {
      key: "matches",
      name: "Matches",
      icon: "game-controller-outline",
      canEnter: true,
      content: (
        <LobbyMatchesStepContent
          isHost={isHost}
          pool={pool}
          configure={configure}
          assignment={assignment}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          onHomeTeamChange={setHomeTeam}
          onAwayTeamChange={setAwayTeam}
        />
      ),
    },
    {
      key: "common",
      name: "Common",
      icon: "tv-outline",
      canEnter: snapshot.assignmentPlan.poolSize > 0,
      content: (
        <LobbyCommonStepContent
          matches={pool.matches}
          commonMatchId={snapshot.commonMatchId}
          isHost={isHost}
          onSelect={configure.setCommonMatch}
        />
      ),
    },
    {
      key: "assign",
      name: "Assign",
      icon: "git-network",
      canEnter: snapshot.commonMatchId !== null || assignment.canPick,
      content: (
        <LobbyAssignmentStepContent
          snapshot={snapshot}
          configure={configure}
          assignment={assignment}
          isHost={isHost}
          onSelectMode={assignment.handleSelectMode}
        />
      ),
    },
  ];
  const firstSlotAction = {
    label: isHost ? "Leave Room" : "Leave",
    icon: "exit-outline" as const,
    iconPosition: "leading" as const,
    testID: "lobby-leave-button",
    disabled: exit.isExiting,
    onPress: onLeave,
    backgroundColor: colors.secondary,
  };
  const finalAction = isHost
    ? {
        label: "Start Game",
        icon: "play" as const,
        testID: "lobby-start-game",
        disabled: configure.isBusy || !assignment.plan.startable,
        onPress: handleStartGame,
        backgroundColor: colors.success,
      }
    : null;

  return <SetupWizard steps={steps} firstSlotAction={firstSlotAction} finalAction={finalAction} />;
}

function LobbyIdentityStepContent({
  lobby,
  exit,
  assignment,
}: {
  lobby: RoomLobbyState;
  exit: RoomLobbyExit;
  assignment: LobbyAssignmentController;
}) {
  return (
    <YStack gap="$4" padding="$4">
      <Text color="$color" fontSize={22} fontWeight="700">Room Lobby</Text>
      <RoomIdentityPanel
        joinCode={lobby.joinCode}
        participants={assignment.participants}
        pickProgress={assignment.pickProgress}
      />
      {exit.error ? <Text color="$danger" fontSize={14} testID="lobby-exit-error">{exit.error}</Text> : null}
    </YStack>
  );
}

function LobbyMatchesStepContent({
  isHost,
  pool,
  configure,
  assignment,
  homeTeam,
  awayTeam,
  onHomeTeamChange,
  onAwayTeamChange,
}: {
  isHost: boolean;
  pool: RoomLobbyPool;
  configure: RoomLobbyConfigure;
  assignment: LobbyAssignmentController;
  homeTeam: string;
  awayTeam: string;
  onHomeTeamChange: (value: string) => void;
  onAwayTeamChange: (value: string) => void;
}) {
  const matchCount = pool.matches.length;
  return (
    <YStack gap="$2">
      <YStack paddingHorizontal={16} paddingTop={16} gap="$1">
        <Text color="$color" fontSize={22} fontWeight="700">Select Matches</Text>
        <Text color="$colorMuted" fontSize={14}>
          {isHost
            ? matchCount === 0
              ? "This room has no matches yet. Add some below to continue."
              : `${matchCount} in this room`
            : `${matchCount} in this room — the host picks these.`}
        </Text>
        {configure.error ? <Text testID="lobby-matches-error" color="$danger" fontSize={14}>{configure.error}</Text> : null}
      </YStack>
      {isHost ? (
        <MatchList
          matches={pool.matches}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          setHomeTeam={onHomeTeamChange}
          setAwayTeam={onAwayTeamChange}
          handleRemoveMatch={pool.removeMatch}
          setGlobalMatches={pool.setMatches}
          showSectionTitle={false}
          disableSelection={configure.isBusy}
        />
      ) : (
        <YStack paddingHorizontal={16} paddingBottom={16}>
          <SelectableMatchList
            matches={assignment.poolAsSelectable}
            selectedMatchIds={[]}
            disabledMatchIds={assignment.poolAsSelectable.map((match) => match.id)}
            onToggleMatch={noop}
          />
        </YStack>
      )}
    </YStack>
  );
}

function LobbyCommonStepContent({
  matches,
  commonMatchId,
  isHost,
  onSelect,
}: {
  matches: RoomLobbyPool["matches"];
  commonMatchId: string | null;
  isHost: boolean;
  onSelect: RoomLobbyConfigure["setCommonMatch"];
}) {
  const handleSelect = useCallback((matchId: string) => {
    if (isHost) void onSelect(matchId);
  }, [isHost, onSelect]);
  return (
    <CommonMatchSelector
      matches={matches}
      selectedCommonMatch={commonMatchId}
      handleSelectCommonMatch={handleSelect}
    />
  );
}

function LobbyAssignmentStepContent({
  snapshot,
  configure,
  assignment,
  isHost,
  onSelectMode,
}: {
  snapshot: RoomLobbySnapshot;
  configure: RoomLobbyConfigure;
  assignment: LobbyAssignmentController;
  isHost: boolean;
  onSelectMode: (mode: AssignmentMode) => void;
}) {
  const pickPanel = assignment.canPick ? (
    <PlayerPickPanel
      matches={assignment.pickableMatches}
      myPicks={assignment.myPicks}
      cap={assignment.plan.matchesPerPlayer}
      onSetPicks={configure.setMyPicks}
      isBusy={configure.isBusy}
    />
  ) : null;
  return (
    <YStack gap="$4" padding="$4">
      {isHost ? (
        <HostAssignmentContent
          snapshot={snapshot}
          configure={configure}
          assignment={assignment}
          pickPanel={pickPanel}
          onSelectMode={onSelectMode}
        />
      ) : (
        <MemberAssignmentContent assignment={assignment} pickPanel={pickPanel} />
      )}
    </YStack>
  );
}

function HostAssignmentContent({
  snapshot,
  configure,
  assignment,
  pickPanel,
  onSelectMode,
}: {
  snapshot: RoomLobbySnapshot;
  configure: RoomLobbyConfigure;
  assignment: LobbyAssignmentController;
  pickPanel: React.ReactNode;
  onSelectMode: (mode: AssignmentMode) => void;
}) {
  const startGame = configure.startGame;
  const handleStartAnyway = useCallback(() => void startGame(true), [startGame]);
  return (
    <>
      <AssignmentModeSelector assignmentMode={assignment.assignmentMode} isBusy={configure.isBusy} onSelectMode={onSelectMode} />
      {pickPanel}
      {assignment.assignmentMode === "host_assigned" ? (
        <HostAllocationGrid
          participants={assignment.participants}
          matches={snapshot.matches}
          commonMatchId={assignment.commonMatchId}
          matchesPerPlayer={assignment.plan.matchesPerPlayer}
          additionalMatchIdsFor={assignment.additionalMatchIdsFor}
          isBusy={configure.isBusy}
          onToggleAllocation={assignment.toggleAllocation}
        />
      ) : null}
      <AssignmentSettingsPanel plan={assignment.plan} isBusy={configure.isBusy} onChange={configure.setAssignmentSettings} />
      <StartGameWarnings
        plan={assignment.plan}
        shortParticipants={assignment.shortParticipants}
        isHostAssigned={assignment.assignmentMode === "host_assigned"}
        error={configure.error}
        isBusy={configure.isBusy}
        onStartAnyway={handleStartAnyway}
      />
    </>
  );
}

function MemberAssignmentContent({
  assignment,
  pickPanel,
}: {
  assignment: LobbyAssignmentController;
  pickPanel: React.ReactNode;
}) {
  return (
    <>
      <Text color="$colorMuted" fontSize={14} lineHeight={20}>
        {assignment.canPick
          ? "Pick your matches while you wait for the host to start."
          : "Waiting for the host to start the game…"}
      </Text>
      <Text testID="lobby-assignment-mode-readonly" color="$colorMuted" fontSize={13}>
        Assignment mode: {ASSIGNMENT_MODE_LABELS[assignment.assignmentMode]}
      </Text>
      {pickPanel}
      <AssignmentRequirementLine plan={assignment.plan} />
    </>
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
      <Text color="$color" fontSize={28} fontWeight="700">
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

function RoomLobbyDialogs({
  assignment,
  configure,
  exit,
  isEndGameConfirmVisible,
  onCloseEndGameConfirmation,
  onEndGame,
  onChooseSuccessor,
  onConfirmClose,
}: {
  assignment: LobbyAssignmentController;
  configure: RoomLobbyConfigure;
  exit: RoomLobbyExit;
  isEndGameConfirmVisible: boolean;
  onCloseEndGameConfirmation: () => void;
  onEndGame: () => Promise<void>;
  onChooseSuccessor: (id: string) => Promise<void>;
  onConfirmClose: () => Promise<void>;
}) {
  return (
    <>
      <AssignmentModeSwitchDialog
        assignment={assignment}
        onConfirm={assignment.handleConfirmModeSwitch}
        onCancel={assignment.handleCancelModeSwitch}
      />
      <EndGameDialogController
        visible={isEndGameConfirmVisible}
        isBusy={configure.isBusy}
        onClose={onCloseEndGameConfirmation}
        onConfirm={onEndGame}
      />
      <RoomExitDialogController
        exit={exit}
        onChooseSuccessor={onChooseSuccessor}
        onConfirmClose={onConfirmClose}
      />
    </>
  );
}

function EndGameDialogController({
  visible,
  isBusy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const handleConfirm = useCallback(() => {
    void onConfirm();
  }, [onConfirm]);

  return (
    <EndGameConfirmationDialog
      visible={visible}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
}

function RoomExitDialogController({
  exit,
  onChooseSuccessor,
  onConfirmClose,
}: {
  exit: RoomLobbyExit;
  onChooseSuccessor: (id: string) => Promise<void>;
  onConfirmClose: () => Promise<void>;
}) {
  const handleChooseSuccessor = useCallback((id: string) => {
    void onChooseSuccessor(id);
  }, [onChooseSuccessor]);
  const handleConfirmClose = useCallback(() => {
    void onConfirmClose();
  }, [onConfirmClose]);

  return (
    <>
      <SuccessorChooserModal
        visible={exit.pendingSuccessorChoice}
        candidates={exit.eligibleSuccessors}
        onChoose={handleChooseSuccessor}
        onCancel={exit.cancel}
      />
      <CloseRoomConfirmationDialog
        visible={exit.needsCloseConfirm}
        onCancel={exit.cancel}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}

function AssignmentModeSwitchDialog({
  assignment,
  onConfirm,
  onCancel,
}: {
  assignment: LobbyAssignmentController;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pendingMode = assignment.pendingModeSwitch;
  return (
    <Modal
      visible={pendingMode !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$backgroundModalOverlay"
        padding="$5"
      >
        <YStack
          testID="lobby-assignment-mode-confirm"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">
            Switch assignment mode?
          </Text>
          <Text color="$colorMuted" fontSize={14}>
            The current draft arrangement will not carry over to{" "}
            {pendingMode ? ASSIGNMENT_MODE_LABELS[pendingMode] : ""}{" "}
            mode.
          </Text>
          {assignment.modeSwitchRaisesMinimum ? (
            <Text
              testID="lobby-assignment-mode-confirm-minimum-notice"
              color="$danger"
              fontSize={13}
            >
              Switching to automatic raises the per-player count to{" "}
              {assignment.automaticMinimum} to satisfy the shared-matches setting.
            </Text>
          ) : null}
          <ShellActionButton
            variant="danger"
            label="Switch mode"
            testID="lobby-assignment-mode-confirm-button"
            onPress={onConfirm}
          />
          <ShellActionButton variant="surface" label="Cancel" onPress={onCancel} />
        </YStack>
      </YStack>
    </Modal>
  );
}

function EndGameConfirmationDialog({
  visible,
  isBusy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$backgroundModalOverlay"
        padding="$5"
      >
        <YStack
          testID="lobby-end-game-confirm"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">End the game?</Text>
          <Text color="$colorMuted" fontSize={14}>
            This finishes the game for everyone in the room. It cannot be resumed.
          </Text>
          <ShellActionButton
            variant="danger"
            label="End game"
            testID="lobby-end-game-confirm-button"
            disabled={isBusy}
            onPress={onConfirm}
          />
          <ShellActionButton variant="surface" label="Cancel" onPress={onClose} />
        </YStack>
      </YStack>
    </Modal>
  );
}

function CloseRoomConfirmationDialog({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$backgroundModalOverlay"
        padding="$5"
      >
        <YStack
          testID="lobby-close-confirm"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">Everyone left</Text>
          <Text color="$colorMuted" fontSize={14}>
            There&apos;s no one left to take over. Close the room?
          </Text>
          <ShellActionButton
            variant="danger"
            label="Close room"
            testID="lobby-close-confirm-button"
            onPress={onConfirm}
          />
          <ShellActionButton variant="surface" label="Cancel" onPress={onCancel} />
        </YStack>
      </YStack>
    </Modal>
  );
}

export default LobbyScreen;
