/**
 * @file lobby/[sessionId].tsx
 * @description Live room lobby for the host and registered members. Polls the durable
 * room snapshot (~4s, no realtime), shows the roster, the host-only join code, and a
 * Leave action that runs ownership handover/closure for the host or a plain leave for a
 * member. Closed/expired rooms return the viewer home.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";

import { ParticipantList } from "../../components/lobby/ParticipantList";
import { RoomEndedNotice } from "../../components/lobby/RoomEndedNotice";
import { SuccessorChooserModal } from "../../components/lobby/SuccessorChooserModal";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useRoomExit } from "../../hooks/useRoomExit";
import { useRoomLobby } from "../../hooks/useRoomLobby";

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

              <Text color="$colorMuted" fontSize={14} lineHeight={20}>
                {lobby.myRole === "owner"
                  ? "Share the join code with your friends. Waiting for players to join…"
                  : "Waiting for the host to start the game…"}
              </Text>

              {exit.error ? (
                <Text color="$danger" fontSize={14} testID="lobby-exit-error">
                  {exit.error}
                </Text>
              ) : null}

              <ShellActionButton
                variant="danger"
                label={lobby.myRole === "owner" ? "Leave Room" : "Leave"}
                testID="lobby-leave-button"
                disabled={exit.isExiting}
                onPress={() => {
                  void handleLeave();
                }}
              />
            </>
          )}

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
