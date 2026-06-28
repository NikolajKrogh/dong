import React from "react";
import { Text, XStack, YStack } from "tamagui";

import type { GuestRoomSession } from "../../types/guestRoom";

interface GuestJoinLobbyProps {
  session: GuestRoomSession;
}

export const GuestJoinLobby: React.FC<GuestJoinLobbyProps> = ({ session }) => {
  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <Text color="$color" fontSize={24} fontWeight="700">
          Guest Room
        </Text>
        <Text color="$colorMuted" fontSize={14}>
          Current state: {session.snapshot.state}
        </Text>
      </YStack>

      <Text color="$colorMuted" fontSize={14} lineHeight={20}>
        You are connected as {session.grant.displayName}. Guest access is
        temporary and only applies to this room on this device.
      </Text>

      <Text color="$color" fontSize={16} fontWeight="700">
        Participants
      </Text>
      {session.snapshot.participants.map((participant) => (
        <XStack
          alignItems="center"
          backgroundColor="$backgroundLight"
          borderColor="$borderColorLight"
          borderRadius="$6"
          borderWidth={1}
          key={participant.id}
          gap="$2"
          padding="$4"
        >
          <Text color="$color" fontSize={15} fontWeight="600">
            {participant.displayName}{" "}
          </Text>
          <Text color="$primary" fontSize={13} fontWeight="600">
            · {participant.membershipType}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
};
