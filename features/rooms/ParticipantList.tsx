import React from "react";
import { Text, XStack, YStack } from "tamagui";

import type { RoomParticipantSummary } from "../../types/room";

interface ParticipantListProps {
  participants: RoomParticipantSummary[];
  /**
   * Per-participant pick progress in player-picked mode (FR-042), keyed by
   * participant id. Rendered as one more badge on the roster every surface
   * already shows, rather than as a second list. Omit it outside player-picked
   * mode — the list then renders exactly as before.
   *
   * Progress for other participants arrives via the room snapshot poll, so it
   * can lag by up to one interval; the label is deliberately a plain count
   * rather than anything implying live confirmation.
   */
  pickProgress?: Record<string, { picked: number; total: number }>;
}

const roleLabel = (participant: RoomParticipantSummary): string => {
  if (participant.sessionRole === "owner") {
    return "owner";
  }
  return participant.membershipType === "guest" ? "guest" : "registered";
};

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  pickProgress,
}) => {
  return (
    <YStack gap="$3">
      <Text color="$color" fontSize={16} fontWeight="700">
        Participants
      </Text>
      {participants.map((participant) => (
        <XStack
          key={participant.id}
          testID={`lobby-participant-${participant.id}`}
          alignItems="center"
          backgroundColor="$backgroundLight"
          borderColor="$borderColorLight"
          borderRadius="$6"
          borderWidth={1}
          gap="$2"
          padding="$4"
        >
          <Text color="$color" fontSize={15} fontWeight="600">
            {participant.displayName}{" "}
          </Text>
          <Text color="$primary" fontSize={13} fontWeight="600">
            · {roleLabel(participant)}
          </Text>
          {pickProgress?.[participant.id] ? (
            <Text
              testID={`lobby-pick-progress-${participant.id}`}
              color="$colorMuted"
              fontSize={13}
              fontWeight="600"
            >
              · {pickProgress[participant.id].picked}/
              {pickProgress[participant.id].total} picked
            </Text>
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
};
