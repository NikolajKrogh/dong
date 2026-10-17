import React from "react";
import { Modal, ScrollView } from "react-native";
import { Text, YStack } from "tamagui";

import type { ActiveGameRoomSync } from "../../hooks/useActiveGameRoomSync";
import { ShellActionButton } from "../ui";

interface RoomStatusModalProps {
  visible: boolean;
  onClose: () => void;
  activeGame: ActiveGameRoomSync;
}

export default function RoomStatusModal({ visible, onClose, activeGame }: RoomStatusModalProps) {
  const permitted = activeGame.status === "ready" || activeGame.status === "refreshing";
  const snapshot = permitted ? activeGame.snapshot : null;
  const message = activeGame.status === "hydrating" ? "Loading your room status…"
    : activeGame.status === "ended" ? "This room has ended. Return Home to start or join another game."
    : activeGame.status === "access_lost" ? "Your room access has expired. Return Home to join again."
    : !snapshot ? "Room status is unavailable. Close this view and retry when connected."
    : "Guest room status is read-only. The host manages configuration.";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <YStack flex={1} justifyContent="center" alignItems="center"
        backgroundColor="$backgroundModalOverlay" padding="$4">
        <YStack backgroundColor="$background" borderRadius="$6" padding="$5"
          maxWidth={480} width="100%" maxHeight="90%" accessibilityViewIsModal>
          <ScrollView>
            <YStack gap="$3" testID="GameRoomStatus">
              <Text color="$color" fontSize="$5" fontWeight="700" accessibilityRole="header">Room status</Text>
              <Text color="$color">{message}</Text>
              {snapshot ? <>
                <Text color="$color">Game: {snapshot.state.replaceAll("_", " ")}</Text>
                <Text color="$color">{snapshot.participants.length} players · {snapshot.matches.length} matches</Text>
              </> : null}
              <ShellActionButton label="Close room status" onPress={onClose} />
            </YStack>
          </ScrollView>
        </YStack>
      </YStack>
    </Modal>
  );
}
