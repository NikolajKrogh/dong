import React from "react";
import { Text, XStack, YStack } from "tamagui";

import type { RoomParticipantSummary } from "../../types/room";

interface ParticipantListProps {
  participants: RoomParticipantSummary[];
}

const roleLabel = (participant: RoomParticipantSummary): string => {
  if (participant.sessionRole === "owner") {
    return "owner";
  }
  return participant.membershipType === "guest" ? "guest" : "registered";
};

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
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
        </XStack>
      ))}
    </YStack>
  );
};
