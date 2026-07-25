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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";

import { ConfigureMatchesModal } from "../../components/lobby/ConfigureMatchesModal";
import { ParticipantList } from "../../components/lobby/ParticipantList";
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
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const hasHydratedGameplayRef = useRef(false);

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

    router.replace("/gameProgress");
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
    pendingModeSwitch === "automatic" && automaticMinimum > plan.matchesPerPlayer;

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
        <YStack flex={1} gap="$5" paddingVertical="$4">
          {lobby.roomEnded ? (
            <RoomEndedNotice onReturnHome={goHome} />
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

              <ParticipantList participants={lobby.participants} />

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
                            widthMode="content"
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
                          widthMode="content"
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

                  <ShellActionButton
                    variant="secondary"
                    label="Configure Matches"
                    testID="lobby-open-configure-matches"
                    disabled={configure.isBusy}
                    onPress={() => setIsMatchModalOpen(true)}
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
                    <XStack gap="$2">
                      {(["automatic", "host_assigned"] as const).map(
                        (mode) => (
                          <ShellActionButton
                            key={mode}
                            variant={
                              assignmentMode === mode ? "primary" : "surface"
                            }
                            size="small"
                            widthMode="content"
                            label={ASSIGNMENT_MODE_LABELS[mode]}
                            testID={`lobby-assignment-mode-${mode === "host_assigned" ? "host-assigned" : mode}`}
                            disabled={configure.isBusy}
                            onPress={() => handleSelectMode(mode)}
                          />
                        ),
                      )}
                    </XStack>
                  </YStack>

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
                                      widthMode="content"
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

                    <XStack alignItems="center" justifyContent="space-between">
                      <Text color="$colorMuted" fontSize={13}>
                        Matches per player (beyond the Common Match)
                      </Text>
                      <XStack alignItems="center" gap="$2">
                        <ShellActionButton
                          variant="surface"
                          size="small"
                          widthMode="content"
                          label="-"
                          testID="lobby-matches-per-player-decrement"
                          disabled={
                            configure.isBusy ||
                            plan.matchesPerPlayer <= 0
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
                          widthMode="content"
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

                    <XStack alignItems="center" justifyContent="space-between">
                      <Text color="$colorMuted" fontSize={13}>
                        Matches shared by every pair of players
                      </Text>
                      <XStack alignItems="center" gap="$2">
                        <ShellActionButton
                          variant="surface"
                          size="small"
                          widthMode="content"
                          label="-"
                          testID="lobby-shared-matches-per-pair-decrement"
                          disabled={
                            configure.isBusy ||
                            plan.sharedMatchesPerPair <= 0
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
                          widthMode="content"
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
                    Waiting for the host to start the game…
                  </Text>
                  <Text
                    testID="lobby-assignment-mode-readonly"
                    color="$colorMuted"
                    fontSize={13}
                  >
                    Assignment mode: {ASSIGNMENT_MODE_LABELS[assignmentMode]}
                  </Text>
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

          <ConfigureMatchesModal
            visible={isMatchModalOpen}
            selectedMatches={lobby.snapshot?.matches ?? []}
            onAdd={(request) => {
              void configure.addMatch(request);
            }}
            onClose={() => setIsMatchModalOpen(false)}
          />

          <Modal
            visible={pendingModeSwitch !== null}
            transparent
            animationType="fade"
            onRequestClose={handleCancelModeSwitch}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
                padding: 24,
              }}
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
            </View>
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
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
                padding: 24,
              }}
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
            </View>
          </Modal>
        </YStack>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default LobbyScreen;
