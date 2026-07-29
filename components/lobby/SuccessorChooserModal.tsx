import React from "react";
import { Modal } from "react-native";
import { Text, YStack } from "tamagui";

import type { RoomParticipantSummary } from "../../types/room";
import { ShellActionButton } from "../ui";

interface SuccessorChooserModalProps {
  visible: boolean;
  candidates: RoomParticipantSummary[];
  onChoose: (participantId: string) => void;
  onCancel: () => void;
}

export const SuccessorChooserModal: React.FC<SuccessorChooserModalProps> = ({
  visible,
  candidates,
  onChoose,
  onCancel,
}) => {
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
          testID="lobby-successor-chooser"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">
            Choose a new host
          </Text>
          <Text color="$colorMuted" fontSize={14}>
            Pick which signed-in player should take over the room.
          </Text>
          {candidates.map((candidate) => (
            <ShellActionButton
              key={candidate.id}
              variant="primary"
              label={candidate.displayName}
              testID={`lobby-successor-${candidate.id}`}
              onPress={() => onChoose(candidate.id)}
            />
          ))}
          <ShellActionButton
            variant="surface"
            label="Cancel"
            testID="lobby-successor-cancel"
            onPress={onCancel}
          />
        </YStack>
      </YStack>
    </Modal>
  );
};
