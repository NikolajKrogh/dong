/**
 * @file HostAllocationGrid.tsx
 * @description Host-assigned mode's per-participant match toggles. Extracted
 * from app/lobby/[sessionId].tsx unchanged.
 */
import React from "react";
import { Text, XStack, YStack } from "tamagui";

import type {
  RoomMatchSummary,
  RoomParticipantSummary,
} from "../../types/room";
import { ShellActionButton } from "../ui";

interface HostAllocationGridProps {
  participants: RoomParticipantSummary[];
  matches: RoomMatchSummary[];
  /** Excluded from the grid — everyone gets the Common Match by definition. */
  commonMatchId: string | null;
  /** The room's per-player target, used for the "held/target" status line. */
  matchesPerPlayer: number;
  /** The non-common match ids currently allocated to a participant. */
  additionalMatchIdsFor: (participantId: string) => string[];
  isBusy: boolean;
  onToggleAllocation: (participantId: string, matchId: string) => void;
}

export const HostAllocationGrid: React.FC<HostAllocationGridProps> = ({
  participants,
  matches,
  commonMatchId,
  matchesPerPlayer,
  additionalMatchIdsFor,
  isBusy,
  onToggleAllocation,
}) => (
  <YStack
    testID="lobby-host-allocation"
    gap="$2"
    backgroundColor="$backgroundLight"
    borderColor="$borderColorLight"
    borderRadius="$5"
    borderWidth={1}
    padding="$3"
  >
    <Text color="$color" fontSize={14} fontWeight="700">
      Allocate matches
    </Text>
    {participants.map((participant) => {
      const held = additionalMatchIdsFor(participant.id);
      const short = held.length < matchesPerPlayer;

      return (
        <YStack key={participant.id} gap="$1">
          <Text
            testID={`lobby-allocation-status-${participant.id}`}
            color={short ? "$danger" : "$colorMuted"}
            fontSize={13}
            fontWeight="600"
          >
            {participant.displayName} — {held.length}/{matchesPerPlayer}
            {short ? " (short)" : ""}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {matches
              .filter((match) => match.id !== commonMatchId)
              .map((match) => {
                const isHeld = held.includes(match.id);

                return (
                  <ShellActionButton
                    key={match.id}
                    variant={isHeld ? "primary" : "surface"}
                    size="small"
                    widthMode="fit"
                    label={`${match.homeTeamName} v ${match.awayTeamName}`}
                    testID={`lobby-allocate-${participant.id}-${match.id}`}
                    disabled={isBusy}
                    onPress={() => onToggleAllocation(participant.id, match.id)}
                  />
                );
              })}
          </XStack>
        </YStack>
      );
    })}
  </YStack>
);

export default HostAllocationGrid;
