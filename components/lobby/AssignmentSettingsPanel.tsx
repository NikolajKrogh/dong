/**
 * @file AssignmentSettingsPanel.tsx
 * @description The host's two assignment-count steppers. Extracted from
 * app/lobby/[sessionId].tsx unchanged.
 *
 * Both steppers send both fields on every change: set_room_assignment_settings
 * takes the pair, not a patch.
 */
import React from "react";
import { Text, XStack, YStack } from "tamagui";

import type {
  AssignmentPlan,
  RoomAssignmentSettingsRequest,
} from "../../types/room";
import { ShellActionButton } from "../ui";

interface AssignmentSettingsPanelProps {
  plan: AssignmentPlan;
  isBusy: boolean;
  onChange: (settings: RoomAssignmentSettingsRequest) => void;
}

export const AssignmentSettingsPanel: React.FC<
  AssignmentSettingsPanelProps
> = ({ plan, isBusy, onChange }) => (
  <YStack
    testID="lobby-assignment-settings"
    gap="$2"
    backgroundColor="$backgroundLight"
    borderColor="$borderColorLight"
    borderRadius="$5"
    borderWidth={1}
    padding="$3"
  >
    <Text color="$color" fontSize={14} fontWeight="700">
      Assignment settings
    </Text>

    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      {/* flexShrink so a long label wraps instead of shoving the stepper out of
          the row and off-screen. */}
      <Text color="$colorMuted" fontSize={13} flexShrink={1}>
        Matches per player (beyond the Common Match)
      </Text>
      <XStack alignItems="center" gap="$2" flexShrink={0}>
        <ShellActionButton
          variant="surface"
          size="small"
          widthMode="fit"
          label="-"
          testID="lobby-matches-per-player-decrement"
          disabled={isBusy || plan.matchesPerPlayer <= 0}
          onPress={() =>
            onChange({
              matchesPerPlayer: Math.max(0, plan.matchesPerPlayer - 1),
              sharedMatchesPerPair: plan.sharedMatchesPerPair,
            })
          }
        />
        <Text
          testID="lobby-matches-per-player-value"
          color="$color"
          fontSize={14}
          fontWeight="700"
          minWidth={20}
          textAlign="center"
        >
          {plan.matchesPerPlayer}
        </Text>
        <ShellActionButton
          variant="surface"
          size="small"
          widthMode="fit"
          label="+"
          testID="lobby-matches-per-player-increment"
          disabled={isBusy}
          onPress={() =>
            onChange({
              matchesPerPlayer: plan.matchesPerPlayer + 1,
              sharedMatchesPerPair: plan.sharedMatchesPerPair,
            })
          }
        />
      </XStack>
    </XStack>

    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      {/* flexShrink so a long label wraps instead of shoving the stepper out of
          the row and off-screen. */}
      <Text color="$colorMuted" fontSize={13} flexShrink={1}>
        Matches shared by every pair of players
      </Text>
      <XStack alignItems="center" gap="$2" flexShrink={0}>
        <ShellActionButton
          variant="surface"
          size="small"
          widthMode="fit"
          label="-"
          testID="lobby-shared-matches-per-pair-decrement"
          disabled={isBusy || plan.sharedMatchesPerPair <= 0}
          onPress={() =>
            onChange({
              matchesPerPlayer: plan.matchesPerPlayer,
              sharedMatchesPerPair: Math.max(0, plan.sharedMatchesPerPair - 1),
            })
          }
        />
        <Text
          testID="lobby-shared-matches-per-pair-value"
          color="$color"
          fontSize={14}
          fontWeight="700"
          minWidth={20}
          textAlign="center"
        >
          {plan.sharedMatchesPerPair}
        </Text>
        <ShellActionButton
          variant="surface"
          size="small"
          widthMode="fit"
          label="+"
          testID="lobby-shared-matches-per-pair-increment"
          disabled={isBusy}
          onPress={() =>
            onChange({
              matchesPerPlayer: plan.matchesPerPlayer,
              sharedMatchesPerPair: plan.sharedMatchesPerPair + 1,
            })
          }
        />
      </XStack>
    </XStack>

    <AssignmentRequirementLine plan={plan} />
  </YStack>
);

/**
 * The room's pool requirement, stated once.
 *
 * Host and member used to render near-identical copy under the same testID from
 * two different branches ("gets" vs "will get"). One element, one wording.
 */
export const AssignmentRequirementLine: React.FC<{ plan: AssignmentPlan }> = ({
  plan,
}) => (
  <Text testID="lobby-assignment-requirement" color="$colorMuted" fontSize={13}>
    Each player will get {plan.effectivePerPlayer} match
    {plan.effectivePerPlayer === 1 ? "" : "es"} plus the Common Match. This room
    needs {plan.requiredPoolSize} selected matches; it currently has{" "}
    {plan.poolSize}.
  </Text>
);

export default AssignmentSettingsPanel;
