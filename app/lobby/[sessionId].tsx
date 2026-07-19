/**
 * @file lobby/[sessionId].tsx
 * @description Live room lobby for the host and registered members. Polls the durable
 * room snapshot (~4s, no realtime), shows the roster, the host-only join code, and a
 * Leave action that runs ownership handover/closure for the host or a plain leave for a
 * member. The host can also select matches, designate a Common Match, randomize
 * assignments, and start the game (US1-US3); every connected device auto-hydrates the
 * gameplay store and redirects to /gameProgress once the room transitions to
 * `in_progress` (US4). Closed/expired rooms return the viewer home.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

                  <ShellActionButton
                    variant="surface"
                    label="Randomize Assignments"
                    testID="lobby-randomize-assignments"
                    disabled={configure.isBusy}
                    onPress={() => {
                      void configure.randomizeAssignments();
                    }}
                  />

                  {configure.error ? (
                    <Text
                      color="$danger"
                      fontSize={14}
                      testID="lobby-configure-error"
                    >
                      {configure.error}
                    </Text>
                  ) : null}

                  <ShellActionButton
                    variant="success"
                    label="Start Game"
                    testID="lobby-start-game"
                    disabled={configure.isBusy}
                    onPress={() => {
                      void configure.startGame();
                    }}
                  />
                </YStack>
              ) : (
                <Text color="$colorMuted" fontSize={14} lineHeight={20}>
                  Waiting for the host to start the game…
                </Text>
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
