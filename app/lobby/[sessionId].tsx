/**
 * @file lobby/[sessionId].tsx
 * @description Room lobby shown to a host immediately after creating a room.
 * Displays the 6-digit join code prominently and lists the host as the owner
 * participant. Real-time participant updates arrive in a later story (US5.2).
 */
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";

import { ShellScreen } from "../../components/ui";

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const LobbyScreen = () => {
  const params = useLocalSearchParams<{
    sessionId: string;
    joinCode: string;
    hostParticipantId: string;
    hostDisplayName: string;
  }>();

  const joinCode = normalizeParam(params.joinCode);
  const hostDisplayName = normalizeParam(params.hostDisplayName) || "Host";

  return (
    <ShellScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} gap="$5" paddingVertical="$4">
          <Text color="$color" fontSize={28} fontWeight="700">
            Room Lobby
          </Text>

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
              {joinCode}
            </Text>
          </YStack>

          <YStack gap="$3">
            <Text color="$color" fontSize={16} fontWeight="700">
              Participants
            </Text>
            <XStack
              testID="lobby-host-participant"
              alignItems="center"
              backgroundColor="$backgroundLight"
              borderColor="$borderColorLight"
              borderRadius="$6"
              borderWidth={1}
              gap="$2"
              padding="$4"
            >
              <Text color="$color" fontSize={15} fontWeight="600">
                {hostDisplayName}{" "}
              </Text>
              <Text color="$primary" fontSize={13} fontWeight="600">
                · owner
              </Text>
            </XStack>
          </YStack>

          <Text color="$colorMuted" fontSize={14} lineHeight={20}>
            Share the join code with your friends. Waiting for players to join…
          </Text>
        </YStack>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default LobbyScreen;
