/**
 * @file AssignmentModeSelector.tsx
 * @description Host-only selector for how the room's matches get allocated.
 * Extracted from app/lobby/[sessionId].tsx unchanged.
 */
import React from "react";
import { Text, XStack, YStack } from "tamagui";

import type { AssignmentMode } from "../../types/room";
import { ShellActionButton } from "../ui";

/** Display names, shared with the member's read-only mode line. */
export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  automatic: "Automatic",
  host_assigned: "Host-assigned",
  player_picked: "Player-picked",
};

/** Kebab-case suffixes for the mode selector's testIDs. */
const MODE_TEST_IDS: Record<AssignmentMode, string> = {
  automatic: "automatic",
  host_assigned: "host-assigned",
  player_picked: "player-picked",
};

const MODES = ["automatic", "host_assigned", "player_picked"] as const;

interface AssignmentModeSelectorProps {
  /** The room's current mode. */
  assignmentMode: AssignmentMode;
  /** Disables every option while a room write is in flight. */
  isBusy: boolean;
  /**
   * Invoked with the tapped mode. The caller owns the FR-030a confirmation gate
   * for switching away from an existing draft — this component never calls the
   * RPC itself.
   */
  onSelectMode: (mode: AssignmentMode) => void;
}

export const AssignmentModeSelector: React.FC<AssignmentModeSelectorProps> = ({
  assignmentMode,
  isBusy,
  onSelectMode,
}) => (
  <YStack
    testID="lobby-assignment-mode"
    gap="$2"
    backgroundColor="$backgroundLight"
    borderColor="$borderColorLight"
    borderRadius="$5"
    borderWidth={1}
    padding="$3"
  >
    <Text color="$color" fontSize={14} fontWeight="700">
      Assignment mode
    </Text>
    {/* Wraps because three labels do not fit one phone row. */}
    <XStack gap="$2" flexWrap="wrap">
      {MODES.map((mode) => (
        <ShellActionButton
          key={mode}
          variant={assignmentMode === mode ? "primary" : "surface"}
          size="small"
          widthMode="fit"
          label={ASSIGNMENT_MODE_LABELS[mode]}
          testID={`lobby-assignment-mode-${MODE_TEST_IDS[mode]}`}
          disabled={isBusy}
          onPress={() => onSelectMode(mode)}
        />
      ))}
    </XStack>
  </YStack>
);

export default AssignmentModeSelector;
