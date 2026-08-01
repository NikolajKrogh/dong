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
import { Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";

import { ParticipantList } from "../../components/lobby/ParticipantList";
import { PlayerPickPanel } from "../../components/lobby/PlayerPickPanel";
import { RoomEndedNotice } from "../../components/lobby/RoomEndedNotice";
import { SuccessorChooserModal } from "../../components/lobby/SuccessorChooserModal";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useRoomConfigure } from "../../hooks/useRoomConfigure";
import { useRoomExit } from "../../hooks/useRoomExit";
import { useRoomLobby } from "../../hooks/useRoomLobby";
import { useGameStore } from "../../store/store";
import type { AssignmentMode } from "../../types/room";

const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  automatic: "Automatic",
  host_assigned: "Host-assigned",
  player_picked: "Player-picked",
};

/** Kebab-case suffixes for the mode selector's testIDs. */
const MODE_TEST_IDS: Record<AssignmentMode, string> = {
  automatic: "automatic",
  host_assigned: "host-assigned",
  player_picked: "player-picked",
};

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

  return (
    <ShellScreen>
      <SafeAreaView style={{ flex: 1 }}>
        {/*
          The lobby's body scrolls. Without this the content below the fold —
          assignment settings, the shortfall warning, Start Game, Leave Room — was
          simply unreachable on a phone: the tree was a flex:1 YStack in a flex:1
          SafeAreaView with nothing scrollable anywhere in it.

          `flexGrow: 1` on the content container keeps the short-content case
          (a room that has ended, which renders only RoomEndedNotice) filling the
          screen rather than hugging the top.
        */}
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
            ) : (
              <>
                <Text color="$color" fontSize={28} fontWeight="700">
                  Room Lobby
                </Text>

                {lobby.joinCode ? (
                  <YStack gap="$2">
                    <Text color="$colorMuted" fontSize={14} fontWeight="600">
                      Join code
                    </Text>
                    <Text
                      testID="lobby-join-code"
                      color="$primary"
                      fontSize={48}
                      fontWeight="800"
                      letterSpacing={6}
                    >
                      {lobby.joinCode}
                    </Text>
                  </YStack>
                ) : null}

                <ParticipantList
                  participants={lobby.participants}
                  pickProgress={pickProgress}
                />

                {isHost && lobby.snapshot ? (
                  <YStack gap="$3">
                    <Text color="$color" fontSize={16} fontWeight="700">
                      Matches ({lobby.snapshot.matches.length})
                    </Text>
                    {lobby.snapshot.matches.map((match) => (
                      <YStack
                        key={match.id}
                        testID={`lobby-match-${match.id}`}
                        gap="$1"
                        backgroundColor="$backgroundLight"
                        borderColor="$borderColorLight"
                        borderRadius="$5"
                        borderWidth={1}
                        padding="$3"
                      >
                        <Text color="$color" fontSize={14} fontWeight="600">
                          {match.homeTeamName} vs {match.awayTeamName}
                          {match.id === lobby.snapshot?.commonMatchId
                            ? "  ⭐ Common Match"
                            : ""}
                        </Text>
                        <XStack gap="$2">
                          {match.id !== lobby.snapshot?.commonMatchId ? (
                            <ShellActionButton
                              variant="surface"
                              size="small"
                              widthMode="fit"
                              label="Make Common Match"
                              testID={`lobby-set-common-${match.id}`}
                              disabled={configure.isBusy}
                              onPress={() => {
                                void configure.setCommonMatch(match.id);
                              }}
                            />
                          ) : null}
                          <ShellActionButton
                            variant="surface"
                            size="small"
                            widthMode="fit"
                            label="Remove"
                            testID={`lobby-remove-match-${match.id}`}
                            disabled={configure.isBusy}
                            onPress={() => {
                              void configure.removeMatch(match.id);
                            }}
                          />
                        </XStack>
                      </YStack>
                    ))}

                    {/*
                    Promoted to the primary style while the pool is too small to
                    start, because that is exactly when adding matches is the one
                    thing standing between the host and Start Game. Once the room
                    has enough it steps back to secondary so it stops competing
                    with Start Game for attention.
                  */}
                    <ShellActionButton
                      variant={
                        plan.poolSize < plan.relaxedFloor
                          ? "primary"
                          : "secondary"
                      }
                      label="Configure Matches"
                      testID="lobby-open-configure-matches"
                      disabled={configure.isBusy}
                      onPress={() =>
                        router.push({
                          pathname: "/lobby/configureMatches",
                          params: {
                            sessionId,
                            participantId: participantId ?? "",
                          },
                        })
                      }
                    />

                    <YStack
                      testID="lobby-assignment-mode"
                      gap="$2"
                      backgroundColor="$backgroundLight"
                      borderColor="$borderColorLight"
                      borderRadius="$5"
                      borderWidth={1}
                      padding="$3"
                    >
                      <Text color="$color" fontSize={14} fontWeight="700">
                        Assignment mode
                      </Text>
                      {/* Wraps because three labels do not fit one phone row. */}
                      <XStack gap="$2" flexWrap="wrap">
                        {(
                          [
                            "automatic",
                            "host_assigned",
                            "player_picked",
                          ] as const
                        ).map((mode) => (
                          <ShellActionButton
                            key={mode}
                            variant={
                              assignmentMode === mode ? "primary" : "surface"
                            }
                            size="small"
                            widthMode="fit"
                            label={ASSIGNMENT_MODE_LABELS[mode]}
                            testID={`lobby-assignment-mode-${MODE_TEST_IDS[mode]}`}
                            disabled={configure.isBusy}
                            onPress={() => handleSelectMode(mode)}
                          />
                        ))}
                      </XStack>
                    </YStack>

                    {/* The host picks their own matches like any other
                      participant (FR-038). */}
                    {pickPanel}

                    {assignmentMode === "host_assigned" ? (
                      <YStack
                        testID="lobby-host-allocation"
                        gap="$2"
                        backgroundColor="$backgroundLight"
                        borderColor="$borderColorLight"
                        borderRadius="$5"
                        borderWidth={1}
                        padding="$3"
                      >
                        <Text color="$color" fontSize={14} fontWeight="700">
                          Allocate matches
                        </Text>
                        {participants.map((participant) => {
                          const held = additionalMatchIdsFor(participant.id);
                          const short = isParticipantShort(participant.id);
                          return (
                            <YStack key={participant.id} gap="$1">
                              <Text
                                testID={`lobby-allocation-status-${participant.id}`}
                                color={short ? "$danger" : "$colorMuted"}
                                fontSize={13}
                                fontWeight="600"
                              >
                                {participant.displayName} — {held.length}/
                                {plan.matchesPerPlayer}
                                {short ? " (short)" : ""}
                              </Text>
                              <XStack gap="$2" flexWrap="wrap">
                                {(lobby.snapshot?.matches ?? [])
                                  .filter((match) => match.id !== commonMatchId)
                                  .map((match) => {
                                    const isHeld = held.includes(match.id);
                                    return (
                                      <ShellActionButton
                                        key={match.id}
                                        variant={isHeld ? "primary" : "surface"}
                                        size="small"
                                        widthMode="fit"
                                        label={`${match.homeTeamName} v ${match.awayTeamName}`}
                                        testID={`lobby-allocate-${participant.id}-${match.id}`}
                                        disabled={configure.isBusy}
                                        onPress={() =>
                                          toggleAllocation(
                                            participant.id,
                                            match.id,
                                          )
                                        }
                                      />
                                    );
                                  })}
                              </XStack>
                            </YStack>
                          );
                        })}
                      </YStack>
                    ) : null}

                    <YStack
                      testID="lobby-assignment-settings"
                      gap="$2"
                      backgroundColor="$backgroundLight"
                      borderColor="$borderColorLight"
                      borderRadius="$5"
                      borderWidth={1}
                      padding="$3"
                    >
                      <Text color="$color" fontSize={14} fontWeight="700">
                        Assignment settings
                      </Text>

                      <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$3"
                      >
                        {/* flexShrink so a long label wraps instead of shoving the
                          stepper out of the row and off-screen. */}
                        <Text color="$colorMuted" fontSize={13} flexShrink={1}>
                          Matches per player (beyond the Common Match)
                        </Text>
                        <XStack alignItems="center" gap="$2" flexShrink={0}>
                          <ShellActionButton
                            variant="surface"
                            size="small"
                            widthMode="fit"
                            label="-"
                            testID="lobby-matches-per-player-decrement"
                            disabled={
                              configure.isBusy || plan.matchesPerPlayer <= 0
                            }
                            onPress={() => {
                              void configure.setAssignmentSettings({
                                matchesPerPlayer: Math.max(
                                  0,
                                  plan.matchesPerPlayer - 1,
                                ),
                                sharedMatchesPerPair: plan.sharedMatchesPerPair,
                              });
                            }}
                          />
                          <Text
                            testID="lobby-matches-per-player-value"
                            color="$color"
                            fontSize={14}
                            fontWeight="700"
                            minWidth={20}
                            textAlign="center"
                          >
                            {plan.matchesPerPlayer}
                          </Text>
                          <ShellActionButton
                            variant="surface"
                            size="small"
                            widthMode="fit"
                            label="+"
                            testID="lobby-matches-per-player-increment"
                            disabled={configure.isBusy}
                            onPress={() => {
                              void configure.setAssignmentSettings({
                                matchesPerPlayer: plan.matchesPerPlayer + 1,
                                sharedMatchesPerPair: plan.sharedMatchesPerPair,
                              });
                            }}
                          />
                        </XStack>
                      </XStack>

                      <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$3"
                      >
                        {/* flexShrink so a long label wraps instead of shoving the
                          stepper out of the row and off-screen. */}
                        <Text color="$colorMuted" fontSize={13} flexShrink={1}>
                          Matches shared by every pair of players
                        </Text>
                        <XStack alignItems="center" gap="$2" flexShrink={0}>
                          <ShellActionButton
                            variant="surface"
                            size="small"
                            widthMode="fit"
                            label="-"
                            testID="lobby-shared-matches-per-pair-decrement"
                            disabled={
                              configure.isBusy || plan.sharedMatchesPerPair <= 0
                            }
                            onPress={() => {
                              void configure.setAssignmentSettings({
                                matchesPerPlayer: plan.matchesPerPlayer,
                                sharedMatchesPerPair: Math.max(
                                  0,
                                  plan.sharedMatchesPerPair - 1,
                                ),
                              });
                            }}
                          />
                          <Text
                            testID="lobby-shared-matches-per-pair-value"
                            color="$color"
                            fontSize={14}
                            fontWeight="700"
                            minWidth={20}
                            textAlign="center"
                          >
                            {plan.sharedMatchesPerPair}
                          </Text>
                          <ShellActionButton
                            variant="surface"
                            size="small"
                            widthMode="fit"
                            label="+"
                            testID="lobby-shared-matches-per-pair-increment"
                            disabled={configure.isBusy}
                            onPress={() => {
                              void configure.setAssignmentSettings({
                                matchesPerPlayer: plan.matchesPerPlayer,
                                sharedMatchesPerPair:
                                  plan.sharedMatchesPerPair + 1,
                              });
                            }}
                          />
                        </XStack>
                      </XStack>

                      <Text
                        testID="lobby-assignment-requirement"
                        color="$colorMuted"
                        fontSize={13}
                      >
                        Each player gets {plan.effectivePerPlayer} match
                        {plan.effectivePerPlayer === 1 ? "" : "es"} plus the
                        Common Match. This room needs {plan.requiredPoolSize}{" "}
                        selected matches; it currently has {plan.poolSize}.
                      </Text>
                    </YStack>

                    {configure.error ? (
                      <Text
                        color="$danger"
                        fontSize={14}
                        testID="lobby-configure-error"
                      >
                        {configure.error}
                      </Text>
                    ) : null}

                    {!plan.startable ? (
                      <Text
                        testID="lobby-start-game-hard-floor-warning"
                        color="$danger"
                        fontSize={14}
                      >
                        This room needs at least {plan.relaxedFloor} selected
                        matches to start at all (the Common Match plus{" "}
                        {plan.effectivePerPlayer} per player) — add more matches
                        before starting.
                      </Text>
                    ) : null}

                    {!plan.feasible && plan.startable ? (
                      <YStack
                        testID="lobby-start-game-shortfall-warning"
                        gap="$2"
                        backgroundColor="$backgroundLight"
                        borderColor="$danger"
                        borderRadius="$5"
                        borderWidth={1}
                        padding="$3"
                      >
                        <Text color="$danger" fontSize={14} fontWeight="600">
                          This room needs {plan.requiredPoolSize} selected
                          matches to honor the assignment settings above, but
                          only has {plan.poolSize}.
                        </Text>
                        <Text color="$colorMuted" fontSize={13}>
                          Add more matches, or start anyway with matches
                          assigned at random (players may end up sharing
                          different matches than configured).
                        </Text>
                        <ShellActionButton
                          variant="danger"
                          label="Start Anyway (Random Assignments)"
                          testID="lobby-start-game-override"
                          disabled={configure.isBusy}
                          onPress={() => {
                            void configure.startGame(true);
                          }}
                        />
                      </YStack>
                    ) : null}

                    {assignmentMode === "host_assigned" &&
                    shortParticipants.length > 0 ? (
                      <Text
                        testID="lobby-start-game-will-fill-in"
                        color="$colorMuted"
                        fontSize={13}
                      >
                        The server will fill in the rest for{" "}
                        {shortParticipants
                          .map((participant) => participant.displayName)
                          .join(", ")}{" "}
                        if you start now.
                      </Text>
                    ) : null}

                    <ShellActionButton
                      variant="success"
                      label="Start Game"
                      testID="lobby-start-game"
                      disabled={configure.isBusy || !plan.startable}
                      onPress={() => {
                        void configure.startGame();
                      }}
                    />
                  </YStack>
                ) : (
                  <YStack gap="$2">
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
                    <Text
                      testID="lobby-assignment-requirement"
                      color="$colorMuted"
                      fontSize={13}
                    >
                      Each player will get {plan.effectivePerPlayer} match
                      {plan.effectivePerPlayer === 1 ? "" : "es"} plus the
                      Common Match. This room needs {plan.requiredPoolSize}{" "}
                      selected matches; it currently has {plan.poolSize}.
                    </Text>
                  </YStack>
                )}

                {exit.error ? (
                  <Text color="$danger" fontSize={14} testID="lobby-exit-error">
                    {exit.error}
                  </Text>
                ) : null}

                <ShellActionButton
                  variant="danger"
                  label={isHost ? "Leave Room" : "Leave"}
                  testID="lobby-leave-button"
                  disabled={exit.isExiting}
                  onPress={() => {
                    void handleLeave();
                  }}
                />
              </>
            )}
          </YStack>
        </ScrollView>

        {/*
          Modals stay OUTSIDE the ScrollView. These are portal-less react-native
          Modals; nesting one inside a scroll container makes its own scrolling and
          gesture handling unreliable.
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
