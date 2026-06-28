import React from "react";
import { Text, YStack } from "tamagui";

import { ShellActionButton } from "../ui";

interface RoomEndedNoticeProps {
  onReturnHome: () => void;
}

export const RoomEndedNotice: React.FC<RoomEndedNoticeProps> = ({
  onReturnHome,
}) => {
  return (
    <YStack gap="$4" testID="lobby-room-ended">
      <Text color="$color" fontSize={22} fontWeight="700">
        Room ended
      </Text>
      <Text color="$colorMuted" fontSize={15} lineHeight={22}>
        This room is no longer available. The host left or the room expired.
      </Text>
      <ShellActionButton
        variant="primary"
        label="Back to home"
        testID="lobby-room-ended-home"
        onPress={onReturnHome}
      />
    </YStack>
  );
};
