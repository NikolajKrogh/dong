import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, {
  useCallback,
  useRef,
  useState
} from "react";
import { Platform } from "react-native";
import { Text, YStack } from "tamagui";
import { LOBBY_STEPS, parseLobbyStep, resolveStep, sameViewParams, withViewParams, type LobbyStep, type RouteParams } from "../../platform/navigation/routeState";
import { useNavigationReady } from "../../platform/navigation/useNavigationReady";
import { useColors } from "../../styles/theme";
import type { AssignmentMode } from "../../types/room";
import { ASSIGNMENT_MODE_LABELS } from "../../types/room";
import { CommonMatchSelector, MatchList, SetupWizard } from "../game-setup";
import {
  SelectableMatchList
} from "../game-setup/SelectableMatchList";
import type { WizardStep } from "../game-setup/SetupWizard";
import { AssignmentModeSelector } from "./AssignmentModeSelector";
import { AssignmentPreviewPanel } from "./AssignmentPreviewPanel";
import { AssignmentSettingsPanel } from "./AssignmentSettingsPanel";
import { PlayerPickPanel } from "./PlayerPickPanel";
import { RoomAssignmentPlayers } from "./RoomAssignmentPlayers";
import { RoomIdentityPanel } from "./RoomIdentityPanel";
import { StartGameWarnings } from "./StartGameWarnings";
import { RoomLobbyConfigure, RoomLobbySnapshot, RoomLobbyState, useLobbyAssignmentController } from "./useLobbyAssignmentController";
import { useRoomExit } from "./useRoomExit";
import { useRoomMatchPool } from "./useRoomMatchPool";
import { roomSnapshotHasAssignmentTargets } from "./roomSnapshotAdapter";

const noop = () => undefined;

export type RoomLobbyExit = ReturnType<typeof useRoomExit>;

type RoomLobbyPool = ReturnType<typeof useRoomMatchPool>;

export type LobbyAssignmentController = ReturnType<typeof useLobbyAssignmentController>;

export function RoomLobbyWizard({
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
  const router = useRouter();
  const navigation = useNavigation();
  const navigationReady = useNavigationReady();
  const params = useLocalSearchParams() as RouteParams;
  const requestedStep = parseLobbyStep(params);
  const [{ activeStep, restoreNotice }, updateRoute] = React.useReducer(
    (state: { activeStep: LobbyStep; restoreNotice: string }, action: { step?: LobbyStep; notice?: string }) => ({
      activeStep: action.step ?? state.activeStep,
      restoreNotice: action.notice ?? state.restoreNotice,
    }),
    { activeStep: "room", restoreNotice: "" },
  );
  const restoredRequest = useRef<string | null>(null);
  const pendingStep = useRef<string | null>(null);
  useFocusEffect(useCallback(() => { pendingStep.current = null; }, []));
  const colors = useColors();
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const startGame = configure.startGame;
  const handleStartGame = () => {
    if (snapshot.assignmentPolicyVersion === 2) { changeStep("assign"); void configure.assignmentPreview.review(); }
    else void startGame();
  };
  const canEnterCommon = snapshot.assignmentPlan.poolSize > 0;
  const canEnterAssign = snapshot.commonMatchId !== null || assignment.canPick;
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
      canEnter: canEnterCommon,
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
      canEnter: canEnterAssign,
      content: (
        <LobbyAssignmentStepContent
          configure={configure}
          assignment={assignment}
          isHost={isHost}
          onSelectMode={assignment.handleSelectMode}
        />
      ),
    },
  ];
  const routeRequest = JSON.stringify([snapshot.sessionId, params.step ?? null]);
  React.useLayoutEffect(() => {
    if (!navigationReady || restoredRequest.current === routeRequest) return;
    restoredRequest.current = routeRequest;
    pendingStep.current = null;
    const step = resolveStep(requestedStep, LOBBY_STEPS, [true, true, canEnterCommon, canEnterAssign]);
    // Restore before paint; polling must not move an active editor.
    updateRoute({
      step, notice: step !== requestedStep
        ? "Complete this step before continuing your room setup." : undefined
    });
    const canonical = withViewParams(params, { step: step === "room" ? undefined : step });
    if (!sameViewParams(params, canonical)) router.setParams({ step: step === "room" ? undefined : step });
  }, [navigationReady, routeRequest, requestedStep, canEnterCommon, canEnterAssign, params, router]);
  const changeStep = (key: string) => {
    const step = resolveStep(key as LobbyStep, LOBBY_STEPS, steps.map(item => item.canEnter));
    if (step === activeStep || step === pendingStep.current) return;
    pendingStep.current = step;
    updateRoute({ notice: "" });
    router.push({ pathname: "/lobby/[sessionId]", params: { ...withViewParams(params, { step: step === "room" ? undefined : step }), sessionId: snapshot.sessionId } });
  };
  const backStep = (key: string) => {
    const step = resolveStep(key as LobbyStep, LOBBY_STEPS, steps.map(item => item.canEnter));
    updateRoute({ notice: "" });
    const stack = navigation.getState();
    const previous = stack?.routes[(stack.index ?? 0) - 1];
    const previousParams = (previous?.params ?? {}) as RouteParams;
    if (router.canGoBack() && previous?.name === "lobby/[sessionId]" && previousParams.sessionId === snapshot.sessionId && parseLobbyStep(previousParams) === step) router.back();
    else router.setParams({ step: step === "room" ? undefined : step });
  };
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
      label: snapshot.assignmentPolicyVersion === 2 ? "Review assignments" : "Start Game",
      icon: "play" as const,
      testID: "lobby-start-game",
      disabled: configure.isBusy || !assignment.plan.startable,
      onPress: handleStartGame,
      backgroundColor: colors.success,
    }
    : null;

  return <YStack flex={1}>
    {restoreNotice ? <Text accessibilityRole="alert">{restoreNotice}</Text> : null}
    {roomSnapshotHasAssignmentTargets(snapshot) ?
      <SetupWizard steps={steps} activeStepKey={activeStep} onStepChange={changeStep} onStepBack={backStep} firstSlotAction={firstSlotAction} finalAction={finalAction} /> :
      <Text accessibilityRole="alert">Player counts are unavailable. Refresh the room before continuing.</Text>}
  </YStack>;
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
      <Text {...(Platform.OS === "web" ? { role: "heading", "aria-level": 1 } : { accessibilityRole: "header" })} color="$color" fontSize={22} fontWeight="700">Room Lobby</Text>
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
  configure,
  assignment,
  isHost,
  onSelectMode,
}: {
  configure: RoomLobbyConfigure;
  assignment: LobbyAssignmentController;
  isHost: boolean;
  onSelectMode: (mode: AssignmentMode) => void;
}) {
  const pickPanel = assignment.canPick ? (
    <PlayerPickPanel
      compact
      title={assignment.participants.find(player => player.id === assignment.participantId)?.displayName ?? "Your matches"}
      matches={assignment.pickableMatches}
      myPicks={assignment.myPicks}
      cap={assignment.plan.targetsByParticipantId?.[assignment.participantId] ?? assignment.plan.matchesPerPlayer}
      onSetPicks={configure.setMyPicks}
      isBusy={configure.isBusy}
    />
  ) : null;
  return (
    <YStack gap="$4" padding="$4">
      {isHost ? (
        <HostAssignmentContent
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
  configure,
  assignment,
  pickPanel,
  onSelectMode,
}: {
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
      <AssignmentSettingsPanel plan={assignment.plan} mode={assignment.assignmentMode} isBusy={configure.isBusy} onChange={configure.setAssignmentSettings} />
      <LobbyAssignmentPlayers
        assignment={assignment}
        pickPanel={pickPanel}
        isBusy={configure.isBusy}
        onToggleAllocation={assignment.assignmentMode === "host_assigned" ? assignment.toggleAllocation : undefined}
        onSetPlayerMatchCount={configure.supportsTargets ? configure.setPlayerMatchCount : undefined}
      />
      {assignment.plan.targetsByParticipantId ? <>
        <AssignmentPreviewPanel preview={configure.assignmentPreview.preview} participants={assignment.participants} matches={assignment.pickableMatches} isBusy={configure.isBusy}
          onReview={() => { void configure.assignmentPreview.review(); }} actionLabel="Start with these assignments"
          onCommit={accept => { void configure.assignmentPreview.commit(accept); }} />
        {configure.error ? <Text accessibilityRole="alert" color="$danger">{configure.error}</Text> : null}
      </> : <StartGameWarnings
        plan={assignment.plan}
        shortParticipants={assignment.shortParticipants}
        isHostAssigned={assignment.assignmentMode === "host_assigned"}
        error={configure.error}
        isBusy={configure.isBusy}
        onStartAnyway={handleStartAnyway}
      />}
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
      {!assignment.canPick ? <Text color="$colorMuted" fontSize={14}>Waiting for the host to start the game.</Text> : null}
      <Text testID="lobby-assignment-mode-readonly" color="$colorMuted" fontSize={13}>
        Assignment mode: {ASSIGNMENT_MODE_LABELS[assignment.assignmentMode]}
      </Text>
      <Text color="$colorMuted" fontSize={13}>Everyone gets the common match.</Text>
      <LobbyAssignmentPlayers assignment={assignment} pickPanel={pickPanel} />
    </>
  );
}

function LobbyAssignmentPlayers({
  assignment,
  pickPanel,
  isBusy = false,
  onToggleAllocation,
  onSetPlayerMatchCount,
}: {
  assignment: LobbyAssignmentController;
  pickPanel: React.ReactNode;
  isBusy?: boolean;
  onToggleAllocation?: (participantId: string, matchId: string) => void;
  onSetPlayerMatchCount?: (participantId: string, count: number | null) => void;
}): React.JSX.Element {
  const participants = pickPanel && !onSetPlayerMatchCount
    ? assignment.participants.filter(player => player.id !== assignment.participantId)
    : assignment.participants;

  function selectedMatchIdsFor(participantId: string): string[] {
    if (assignment.assignmentMode === "player_picked") {
      return assignment.picks
        .filter(pick => pick.participantId === participantId)
        .map(pick => pick.matchId);
    }
    return assignment.additionalMatchIdsFor(participantId);
  }

  return (
    <RoomAssignmentPlayers
      participants={participants}
      matches={assignment.pickableMatches}
      matchesPerPlayer={assignment.plan.matchesPerPlayer}
      targetsByParticipantId={assignment.plan.targetsByParticipantId}
      onSetPlayerMatchCount={onSetPlayerMatchCount}
      isBusy={isBusy}
      ownPicks={pickPanel}
      pending={assignment.assignmentMode === "automatic"}
      selectedMatchIdsFor={selectedMatchIdsFor}
      onToggleAllocation={onToggleAllocation}
    />
  );
}
