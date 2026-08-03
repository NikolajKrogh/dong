/**
 * @file RoomIdentityPanel.tsx
 * @description Who and where: the host-only join code and the live roster. The
 * one part of a room that every viewer sees identically, host or member.
 * Extracted from app/lobby/[sessionId].tsx unchanged.
 */
import React from "react";
import { Text, YStack } from "tamagui";

import type { RoomParticipantSummary } from "../../types/room";
import { ParticipantList } from "./ParticipantList";

interface RoomIdentityPanelProps {
  /** Null for a member — useRoomLobby only exposes it to the owner. */
  joinCode: string | null;
  participants: RoomParticipantSummary[];
  /** Per-participant pick counts; only set in player-picked mode (FR-042). */
  pickProgress?: Record<string, { picked: number; total: number }>;
}

export const RoomIdentityPanel: React.FC<RoomIdentityPanelProps> = ({
  joinCode,
  participants,
  pickProgress,
}) => (
  <>
    {joinCode ? (
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
    ) : null}

    <ParticipantList participants={participants} pickProgress={pickProgress} />
  </>
);

export default RoomIdentityPanel;
