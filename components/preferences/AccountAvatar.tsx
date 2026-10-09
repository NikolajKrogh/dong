import React from "react";
import { Text, YStack } from "tamagui";

export default function AccountAvatar({ letter }: { letter: string }) {
  return (
    <YStack
      width={44}
      height={44}
      borderRadius={22}
      backgroundColor="$primary"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Text color="$textLight" fontSize={18} fontWeight="700">
        {letter}
      </Text>
    </YStack>
  );
}
