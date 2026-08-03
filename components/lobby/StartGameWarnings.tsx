/**
 * @file StartGameWarnings.tsx
 * @description Everything the host needs to read between the assignment
 * settings and Start Game. Extracted from app/lobby/[sessionId].tsx unchanged.
 *
 * Three distinct states, deliberately not collapsed into one:
 *   - `!startable`: the pool is below the hard floor. Nothing can start.
 *   - `!feasible && startable`: the pool honours the floor but not the
 *     configured settings. Startable, with random assignments, if the host says
 *     so — which is why the override button lives inside this block, next to the
 *     copy that explains it.
 *   - host_assigned with short participants: startable as configured; the
 *     server fills the gaps.
 */
import React from "react";
import { Text, YStack } from "tamagui";

import type { AssignmentPlan, RoomParticipantSummary } from "../../types/room";
import { ShellActionButton } from "../ui";

interface StartGameWarningsProps {
  plan: AssignmentPlan;
  /** Participants below the per-player target; only meaningful host-assigned. */
  shortParticipants: RoomParticipantSummary[];
  /** True when the room is in host_assigned mode. */
  isHostAssigned: boolean;
  /** The last room-write error, if any. */
  error: string | null;
  isBusy: boolean;
  /** Starts the game with `relaxConstraints`, i.e. random assignments. */
  onStartAnyway: () => void;
}

export const StartGameWarnings: React.FC<StartGameWarningsProps> = ({
  plan,
  shortParticipants,
  isHostAssigned,
  error,
  isBusy,
  onStartAnyway,
}) => (
  <>
    {error ? (
      <Text color="$danger" fontSize={14} testID="lobby-configure-error">
        {error}
      </Text>
    ) : null}

    {!plan.startable ? (
      <Text
        testID="lobby-start-game-hard-floor-warning"
        color="$danger"
        fontSize={14}
      >
        This room needs at least {plan.relaxedFloor} selected matches to start
        at all (the Common Match plus {plan.effectivePerPlayer} per player) —
        add more matches before starting.
      </Text>
    ) : null}

    {!plan.feasible && plan.startable ? (
      <YStack
        testID="lobby-start-game-shortfall-warning"
        gap="$2"
        backgroundColor="$backgroundLight"
        borderColor="$danger"
        borderRadius="$5"
        borderWidth={1}
        padding="$3"
      >
        <Text color="$danger" fontSize={14} fontWeight="600">
          This room needs {plan.requiredPoolSize} selected matches to honor the
          assignment settings above, but only has {plan.poolSize}.
        </Text>
        <Text color="$colorMuted" fontSize={13}>
          Add more matches, or start anyway with matches assigned at random
          (players may end up sharing different matches than configured).
        </Text>
        <ShellActionButton
          variant="danger"
          label="Start Anyway (Random Assignments)"
          testID="lobby-start-game-override"
          disabled={isBusy}
          onPress={onStartAnyway}
        />
      </YStack>
    ) : null}

    {isHostAssigned && shortParticipants.length > 0 ? (
      <Text
        testID="lobby-start-game-will-fill-in"
        color="$colorMuted"
        fontSize={13}
      >
        The server will fill in the rest for{" "}
        {shortParticipants
          .map((participant) => participant.displayName)
          .join(", ")}{" "}
        if you start now.
      </Text>
    ) : null}
  </>
);

export default StartGameWarnings;
