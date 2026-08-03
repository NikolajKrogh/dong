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
import { SelectableMatchList } from "../../components/matchSelection/SelectableMatchList";
import {
  ASSIGNMENT_MODE_LABELS,
  AssignmentModeSelector,
} from "../../components/lobby/AssignmentModeSelector";
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
import { useRoomMatchPool } from "../../hooks/useRoomMatchPool";
import { useGameStore } from "../../store/store";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import type { AssignmentMode, BatchRoomMatchResult } from "../../types/room";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const LobbyScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId: string;
    participantId: string;
  }>();
  const sessionId = normalizeParam(params.sessionId);
  const participantId = normalizeParam(params.participantId) || null;

  const lobby = useRoomLobby(sessionId || null, participantId);
  const exit = useRoomExit();
  const hasHydratedGameplayRef = useRef(false);
  // Whether this mount ever saw the room *before* it started. It is the only
  // thing that separates "the game just started while I was watching the lobby"
  // (redirect, FR-012) from "I opened the lobby of a game already running"
  // (stay). Both look identical on the first snapshot after mount, which is why
  // returning to a running room used to bounce straight back into the game and
  // made the lobby unreachable.
  const seenPreStartRef = useRef(false);

  const configure = useRoomConfigure(lobby.snapshot, lobby.refresh);
  const [pendingModeSwitch, setPendingModeSwitch] =
    useState<AssignmentMode | null>(null);

  const { width } = useWindowDimensions();
  const wideLayout = isWideLayout(width);
  const colors = useColors();

  // Manual-entry fields belong to MatchList's caller in the solo wizard too.
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");

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

  const setPlayers = useGameStore((state) => state.setPlayers);
  const setMatches = useGameStore((state) => state.setMatches);
  const setCommonMatchId = useGameStore((state) => state.setCommonMatchId);
  const setPlayerAssignments = useGameStore(
    (state) => state.setPlayerAssignments,
  );

  const goHome = useCallback(() => {
    router.replace("/");
  }, [router]);

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

  // US4 (FR-012): once the snapshot flips to in_progress, hydrate the gameplay
  // store from the room's final configuration and redirect every connected device.
  useEffect(() => {
    if (lobby.snapshot && !lobby.gameStarted) {
      seenPreStartRef.current = true;
    }
  }, [lobby.gameStarted, lobby.snapshot]);

  useEffect(() => {
    const snapshot = lobby.snapshot;
    if (!lobby.gameStarted || !snapshot || hasHydratedGameplayRef.current) {
      return;
    }
    hasHydratedGameplayRef.current = true;

    setPlayers(
      snapshot.participants.map((participant) => ({
        id: participant.id,
        name: participant.displayName,
        drinksTaken: participant.currentDrinkTotal,
      })),
    );
    setMatches(
      snapshot.matches.map((match) => ({
        id: match.id,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        homeGoals: match.homeScore,
        awayGoals: match.awayScore,
        startTime: match.kickoffAt ?? undefined,
      })),
    );
    setCommonMatchId(snapshot.commonMatchId);
    setPlayerAssignments(
      snapshot.participants.reduce<Record<string, string[]>>(
        (accumulator, participant) => {
          accumulator[participant.id] = snapshot.assignments
            .filter(
              (assignment) =>
                assignment.participantId === participant.id &&
                assignment.matchId !== snapshot.commonMatchId,
            )
            .map((assignment) => assignment.matchId);
          return accumulator;
        },
        {},
      ),
    );

    // Hydration always runs -- "Return to game" below needs a populated store --
    // but only a start observed from this lobby redirects.
    if (seenPreStartRef.current) {
      router.replace("/gameProgress");
    }
  }, [
    lobby.gameStarted,
    lobby.snapshot,
    router,
    setCommonMatchId,
    setMatches,
    setPlayerAssignments,
    setPlayers,
  ]);

  const isHost = lobby.myRole === "owner";
  // Null-safe fallback so the JSX below never has to guard snapshot presence
  // separately from isHost; a snapshot-less render simply shows an "empty" plan.
  const plan = lobby.snapshot?.assignmentPlan ?? {
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
  const assignmentMode: AssignmentMode =
    lobby.snapshot?.assignmentMode ?? "automatic";
  const participants = lobby.snapshot?.participants ?? [];
  const assignments = useMemo(
    () => lobby.snapshot?.assignments ?? [],
    [lobby.snapshot?.assignments],
  );
  const commonMatchId = lobby.snapshot?.commonMatchId ?? null;
  const hasDraft = assignments.length > 0;

  // FR-030a: switching mode with an existing draft requires confirmation
  // before the server call is made — the RPC itself has no way to know
  // whether a draft existed, so this gate is entirely client-side
  // (research.md R10).
  const handleSelectMode = useCallback(
    (mode: AssignmentMode) => {
      if (mode === assignmentMode) {
        return;
      }
      if (hasDraft) {
        setPendingModeSwitch(mode);
        return;
      }
      void configure.setAssignmentMode(mode);
    },
    [assignmentMode, configure, hasDraft],
  );

  const handleConfirmModeSwitch = useCallback(() => {
    if (pendingModeSwitch) {
      void configure.setAssignmentMode(pendingModeSwitch);
    }
    setPendingModeSwitch(null);
  }, [configure, pendingModeSwitch]);

  const handleCancelModeSwitch = useCallback(() => {
    setPendingModeSwitch(null);
  }, []);

  // spec.md edge case: switching to automatic can silently raise the
  // effective per-player count past what the host was shown (FR-009's
  // minimum). Surface that in the same confirmation surface rather than
  // letting FR-032 change it invisibly at start (T015a).
  const automaticMinimum =
    plan.sharedMatchesPerPair * Math.max(participants.length - 1, 0);
  const modeSwitchRaisesMinimum =
    pendingModeSwitch === "automatic" &&
    automaticMinimum > plan.matchesPerPlayer;

  // research.md R9: per-participant "still short" is derived client-side from
  // the snapshot's own assignments array — no server field needed.
  const additionalMatchIdsFor = useCallback(
    (participantId: string) =>
      assignments
        .filter(
          (assignment) =>
            assignment.participantId === participantId &&
            assignment.matchId !== commonMatchId,
        )
        .map((assignment) => assignment.matchId),
    [assignments, commonMatchId],
  );
  const isParticipantShort = useCallback(
    (participantId: string) =>
      additionalMatchIdsFor(participantId).length < plan.matchesPerPlayer,
    [additionalMatchIdsFor, plan.matchesPerPlayer],
  );
  const shortParticipants = participants.filter((participant) =>
    isParticipantShort(participant.id),
  );

  // ---------------------------------------------------------------------------
  // Player-picked mode (#185). The pick panel renders for the host and members
  // alike — the host is an ordinary participant who picks their own matches.
  // ---------------------------------------------------------------------------
  const picks = useMemo(
    () => lobby.snapshot?.picks ?? [],
    [lobby.snapshot?.picks],
  );
  const isPlayerPicked = assignmentMode === "player_picked";
  const canPick = isPlayerPicked && lobby.state === "joinable";

  // RoomMatchSummary → the shared renderer's view-model, minus the Common Match
  // (FR-040a). Mapped here rather than inside the panel because the guest
  // surface's match type doesn't unify with this one.
  const pickableMatches = useMemo(
    () =>
      (lobby.snapshot?.matches ?? [])
        .filter((match) => match.id !== commonMatchId)
        .map((match) => ({
          id: match.id,
          homeTeam: match.homeTeamName,
          awayTeam: match.awayTeamName,
          startTime: match.kickoffAt ?? undefined,
        })),
    [lobby.snapshot?.matches, commonMatchId],
  );

  // The whole pool, for the member's read-only Matches step. Deliberately not
  // `pickableMatches` below — that one drops the Common Match, which belongs in
  // a list of "the matches this room has".
  const poolAsSelectable = useMemo(
    () =>
      (lobby.snapshot?.matches ?? []).map((match) => ({
        id: match.id,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        startTime: match.kickoffAt ?? undefined,
      })),
    [lobby.snapshot?.matches],
  );

  const myPicks = useMemo(
    () =>
      participantId
        ? picks
            .filter((pick) => pick.participantId === participantId)
            .map((pick) => pick.matchId)
        : [],
    [picks, participantId],
  );

  // FR-042: everyone sees how far everyone else has progressed.
  const pickProgress = useMemo(() => {
    if (!isPlayerPicked) {
      return undefined;
    }
    return participants.reduce<
      Record<string, { picked: number; total: number }>
    >((accumulator, participant) => {
      accumulator[participant.id] = {
        picked: picks.filter((pick) => pick.participantId === participant.id)
          .length,
        total: plan.matchesPerPlayer,
      };
      return accumulator;
    }, {});
  }, [isPlayerPicked, participants, picks, plan.matchesPerPlayer]);

  const pickPanel = canPick ? (
    <PlayerPickPanel
      matches={pickableMatches}
      myPicks={myPicks}
      cap={plan.matchesPerPlayer}
      onSetPicks={configure.setMyPicks}
      isBusy={configure.isBusy}
    />
  ) : null;

  // set_room_assignments replaces the room's *entire* assignment set on every
  // call (migration 035) — toggling one participant's one match means
  // reconstructing the full desired array from the current snapshot, not
  // sending a diff.
  const toggleAllocation = useCallback(
    (participantId: string, matchId: string) => {
      const exists = assignments.some(
        (assignment) =>
          assignment.participantId === participantId &&
          assignment.matchId === matchId,
      );
      const next = exists
        ? assignments.filter(
            (assignment) =>
              !(
                assignment.participantId === participantId &&
                assignment.matchId === matchId
              ),
          )
        : [...assignments, { participantId, matchId }];
      void configure.setAssignments(next);
    },
    [assignments, configure],
  );

  // ---------------------------------------------------------------------------
  // The pre-start room, as the single-player setup wizard.
  //
  // Every viewer gets the same four steps in the same order — a member's steps
  // are the host's, read-only, plus their own pick panel. Same length and same
  // order matters mechanically, not just visually: SetupWizard's current step is
  // uncontrolled, so a steps array that changed shape between polls would
  // remount the wizard and drop the viewer back to step one every ~4 seconds.
  //
  // For the same reason these are JSX values, never components declared here.
  // ---------------------------------------------------------------------------
  const isPreStart = !lobby.roomEnded && !lobby.gameStarted;

  const roomStepContent = (
    <YStack gap="$4" padding="$4">
      <Text color="$color" fontSize={22} fontWeight="700">
        Room Lobby
      </Text>
      <RoomIdentityPanel
        joinCode={lobby.joinCode}
        participants={lobby.participants}
        pickProgress={pickProgress}
      />
      {exit.error ? (
        <Text color="$danger" fontSize={14} testID="lobby-exit-error">
          {exit.error}
        </Text>
      ) : null}
    </YStack>
  );

  const matchesStepContent = (
    <YStack gap="$2">
      <YStack paddingHorizontal={16} paddingTop={16} gap="$1">
        <Text color="$color" fontSize={22} fontWeight="700">
          Select Matches
        </Text>
        <Text color="$colorMuted" fontSize={14}>
          {isHost
            ? pool.matches.length === 0
              ? "This room has no matches yet. Add some below to continue."
              : `${pool.matches.length} in this room`
            : `${pool.matches.length} in this room — the host picks these.`}
        </Text>
        {/*
          Adds and removals are server round-trips that can fail on this step,
          and the Assign step's own error line is nowhere in sight from here.
          Its own testID, deliberately: one testID per surface.
        */}
        {configure.error ? (
          <Text testID="lobby-matches-error" color="$danger" fontSize={14}>
            {configure.error}
          </Text>
        ) : null}
      </YStack>

      {isHost ? (
        /*
          `showSectionTitle={false}` because the heading above is this step's;
          leaving both on stacked two titles from two type systems.
          `disableSelection` while a write is in flight — unlike the solo flow,
          releasing a match here is a server round-trip.
        */
        <MatchList
          matches={pool.matches}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          setHomeTeam={setHomeTeam}
          setAwayTeam={setAwayTeam}
          handleRemoveMatch={pool.removeMatch}
          setGlobalMatches={pool.setMatches}
          showSectionTitle={false}
          disableSelection={configure.isBusy}
        />
      ) : (
        /*
          Not a defanged MatchList: that is an acquisition UI (league filter,
          catalogue, manual entry) a member has no permission to use. This is
          the pool, shown inert.
        */
        <YStack paddingHorizontal={16} paddingBottom={16}>
          <SelectableMatchList
            matches={poolAsSelectable}
            selectedMatchIds={[]}
            disabledMatchIds={poolAsSelectable.map((match) => match.id)}
            onToggleMatch={() => {}}
          />
        </YStack>
      )}
    </YStack>
  );

  const commonStepContent = (
    <CommonMatchSelector
      matches={pool.matches}
      selectedCommonMatch={commonMatchId}
      // Read-only for a member: the cards stay, the write does not.
      handleSelectCommonMatch={
        isHost
          ? (matchId: string) => {
              void configure.setCommonMatch(matchId);
            }
          : () => {}
      }
    />
  );

  const assignStepContent = (
    <YStack gap="$4" padding="$4">
      {isHost ? (
        <>
          <AssignmentModeSelector
            assignmentMode={assignmentMode}
            isBusy={configure.isBusy}
            onSelectMode={handleSelectMode}
          />

          {/* The host picks their own matches like any other participant
              (FR-038). */}
          {pickPanel}

          {assignmentMode === "host_assigned" ? (
            <HostAllocationGrid
              participants={participants}
              matches={lobby.snapshot?.matches ?? []}
              commonMatchId={commonMatchId}
              matchesPerPlayer={plan.matchesPerPlayer}
              additionalMatchIdsFor={additionalMatchIdsFor}
              isBusy={configure.isBusy}
              onToggleAllocation={toggleAllocation}
            />
          ) : null}

          <AssignmentSettingsPanel
            plan={plan}
            isBusy={configure.isBusy}
            onChange={(settings) => {
              void configure.setAssignmentSettings(settings);
            }}
          />

          <StartGameWarnings
            plan={plan}
            shortParticipants={shortParticipants}
            isHostAssigned={assignmentMode === "host_assigned"}
            error={configure.error}
            isBusy={configure.isBusy}
            onStartAnyway={() => {
              void configure.startGame(true);
            }}
          />
        </>
      ) : (
        <>
          <Text color="$colorMuted" fontSize={14} lineHeight={20}>
            {canPick
              ? "Pick your matches while you wait for the host to start."
              : "Waiting for the host to start the game…"}
          </Text>
          <Text
            testID="lobby-assignment-mode-readonly"
            color="$colorMuted"
            fontSize={13}
          >
            Assignment mode: {ASSIGNMENT_MODE_LABELS[assignmentMode]}
          </Text>

          {/* A member's own pick control — the same panel the host uses. */}
          {pickPanel}
          <AssignmentRequirementLine plan={plan} />
        </>
      )}
    </YStack>
  );

  const roomSteps: WizardStep[] = [
    {
      key: "room",
      name: "Room",
      icon: "people",
      canEnter: true,
      content: roomStepContent,
    },
    {
      key: "matches",
      name: "Matches",
      icon: "game-controller-outline",
      canEnter: Boolean(lobby.snapshot),
      content: matchesStepContent,
    },
    {
      key: "common",
      name: "Common",
      icon: "tv-outline",
      canEnter: Boolean(lobby.snapshot) && plan.poolSize > 0,
      content: commonStepContent,
    },
    {
      key: "assign",
      name: "Assign",
      icon: "git-network",
      // `canPick` is an alternative to the Common Match being set, not an
      // addition to it: a member with picks to make must be able to reach the
      // pick panel even before the host has designated a Common Match.
      canEnter: Boolean(lobby.snapshot) && (commonMatchId !== null || canPick),
      content: assignStepContent,
    },
  ];

  return (
    <ShellScreen
      padded={!isPreStart}
      centerContent={isPreStart && wideLayout}
      contentMaxWidth={isPreStart && wideLayout ? 1120 : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {isPreStart ? (
          /*
            No ScrollView around the wizard, and this is load-bearing rather
            than tidiness: the wizard's own `stepContentScroll` needs a bounded
            parent. Give it an unbounded one and `wizardMainPanel` collapses,
            which shows up as an empty step body rather than as an error.
          */
          <SetupWizard
            steps={roomSteps}
            firstSlotAction={{
              label: isHost ? "Leave Room" : "Leave",
              icon: "exit-outline",
              iconPosition: "leading",
              testID: "lobby-leave-button",
              disabled: exit.isExiting,
              onPress: () => {
                void handleLeave();
              },
              backgroundColor: colors.secondary,
            }}
            // A member gets no final action — SetupWizard renders its "Waiting
            // for host" placeholder so the nav bar keeps both slots.
            finalAction={
              isHost
                ? {
                    label: "Start Game",
                    icon: "play",
                    testID: "lobby-start-game",
                    disabled: configure.isBusy || !plan.startable,
                    onPress: () => {
                      void configure.startGame();
                    },
                    backgroundColor: colors.success,
                  }
                : null
            }
          />
        ) : (
          /*
            The ended and in-progress bodies still scroll: they are plain
            stacked content, and without this the material below the fold was
            unreachable on a phone.

            `flexGrow: 1` keeps the short-content case (a room that has ended,
            which renders only RoomEndedNotice) filling the screen rather than
            hugging the top.
          */
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <YStack flex={1} gap="$5" paddingVertical="$4">
              {lobby.roomEnded ? (
                <RoomEndedNotice onReturnHome={goHome} />
              ) : lobby.gameStarted ? (
                /*
              A game that is already under way. None of the configure controls
              below apply once the server has generated the assignments, so this
              is deliberately just the roster and the three ways out.
            */
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
                    pickProgress={pickProgress}
                  />

                  <ShellActionButton
                    variant="primary"
                    label="Return to game"
                    testID="lobby-return-to-game"
                    onPress={handleReturnToGame}
                  />

                  {isHost ? (
                    <ShellActionButton
                      variant="danger"
                      label="End game for everyone"
                      testID="lobby-end-game"
                      disabled={configure.isBusy}
                      onPress={() => {
                        setIsEndGameConfirmVisible(true);
                      }}
                    />
                  ) : null}

                  <ShellActionButton
                    variant="surface"
                    label={isHost ? "Leave Room" : "Leave"}
                    testID="lobby-in-progress-leave"
                    disabled={exit.isExiting}
                    onPress={() => {
                      void handleLeave();
                    }}
                  />

                  {configure.error ? (
                    <Text
                      color="$danger"
                      fontSize={13}
                      testID="lobby-in-progress-error"
                    >
                      {configure.error}
                    </Text>
                  ) : null}
                  {exit.error ? (
                    <Text color="$danger" fontSize={13}>
                      {exit.error}
                    </Text>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>
          </ScrollView>
        )}

        {/*
          Modals stay OUTSIDE the ScrollView — and outside the wizard, never in
          a step's `content`, which renders inside the wizard's own ScrollView.
          These are portal-less react-native Modals; nesting one inside a scroll
          container makes its own scrolling and gesture handling unreliable.
        */}
        <Modal
          visible={pendingModeSwitch !== null}
          transparent
          animationType="fade"
          onRequestClose={handleCancelModeSwitch}
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
                {pendingModeSwitch
                  ? ASSIGNMENT_MODE_LABELS[pendingModeSwitch]
                  : ""}{" "}
                mode.
              </Text>
              {modeSwitchRaisesMinimum ? (
                <Text
                  testID="lobby-assignment-mode-confirm-minimum-notice"
                  color="$danger"
                  fontSize={13}
                >
                  Switching to automatic raises the per-player count to{" "}
                  {automaticMinimum} to satisfy the shared-matches setting.
                </Text>
              ) : null}
              <ShellActionButton
                variant="danger"
                label="Switch mode"
                testID="lobby-assignment-mode-confirm-button"
                onPress={handleConfirmModeSwitch}
              />
              <ShellActionButton
                variant="surface"
                label="Cancel"
                onPress={handleCancelModeSwitch}
              />
            </YStack>
          </YStack>
        </Modal>

        <Modal
          visible={isEndGameConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setIsEndGameConfirmVisible(false);
          }}
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
              <Text color="$color" fontSize={20} fontWeight="700">
                End the game?
              </Text>
              <Text color="$colorMuted" fontSize={14}>
                This finishes the game for everyone in the room. It cannot be
                resumed.
              </Text>
              <ShellActionButton
                variant="danger"
                label="End game"
                testID="lobby-end-game-confirm-button"
                disabled={configure.isBusy}
                onPress={() => {
                  void handleEndGame();
                }}
              />
              <ShellActionButton
                variant="surface"
                label="Cancel"
                onPress={() => {
                  setIsEndGameConfirmVisible(false);
                }}
              />
            </YStack>
          </YStack>
        </Modal>

        <SuccessorChooserModal
          visible={exit.pendingSuccessorChoice}
          candidates={exit.eligibleSuccessors}
          onChoose={(id) => {
            void handleChooseSuccessor(id);
          }}
          onCancel={exit.cancel}
        />

        <Modal
          visible={exit.needsCloseConfirm}
          transparent
          animationType="fade"
          onRequestClose={exit.cancel}
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
              <Text color="$color" fontSize={20} fontWeight="700">
                Everyone left
              </Text>
              <Text color="$colorMuted" fontSize={14}>
                There's no one left to take over. Close the room?
              </Text>
              <ShellActionButton
                variant="danger"
                label="Close room"
                testID="lobby-close-confirm-button"
                onPress={() => {
                  void handleConfirmClose();
                }}
              />
              <ShellActionButton
                variant="surface"
                label="Cancel"
                onPress={exit.cancel}
              />
            </YStack>
          </YStack>
        </Modal>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default LobbyScreen;
