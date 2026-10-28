import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { AssignmentMode } from "../../types/room";
import { AssignmentInfoModal } from "../../features/game-setup/AssignmentControls";
import AppIcon from "../AppIcon";
import { ASSIGNMENT_MODE_LABELS } from "../../types/room";
import createSetupGameStyles from "../../features/game-setup/setupGameStyles";
import { useColors } from "../../styles/theme";

const MODES = ["automatic", "host_assigned", "player_picked"] as const;
const SHORT_LABELS = {
  automatic: "Automatic",
  host_assigned: "Host assigns",
  player_picked: "Players pick",
};
const MODE_HELP: Record<AssignmentMode, string> = {
  automatic:
    "Matches are distributed automatically when you confirm the assignments. Everyone gets the common match. Use Shared matches to control how many additional matches each pair shares.",
  host_assigned:
    "Open a player to assign their matches. Everyone gets the common match.",
  player_picked:
    "Each player chooses their own matches. You can follow their progress below. Everyone gets the common match.",
};

interface AssignmentModeSelectorProps {
  assignmentMode: AssignmentMode;
  allowPlayerPicked?: boolean;
  isBusy: boolean;
  onSelectMode: (mode: AssignmentMode) => void;
}

export function AssignmentModeSelector({
  assignmentMode,
  allowPlayerPicked = true,
  isBusy,
  onSelectMode,
}: AssignmentModeSelectorProps): React.JSX.Element {
  const [showHelp, setShowHelp] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  return (
    <View testID="lobby-assignment-mode">
      <View style={styles.sectionHeader}>
        <Text style={styles.filterSectionTitle}>Assignment mode</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="About assignment modes"
          hitSlop={10}
          onPress={() => setShowHelp(true)}
        >
          <AppIcon
            name="information-circle-outline"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
      <AssignmentInfoModal
        visible={showHelp}
        message={MODE_HELP[assignmentMode]}
        onClose={() => setShowHelp(false)}
        styles={styles}
      />
      <View style={styles.assignmentModeTabs}>
        {MODES.filter(mode => allowPlayerPicked || mode !== "player_picked").map((mode) => (
          <TouchableOpacity
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={ASSIGNMENT_MODE_LABELS[mode]}
            accessibilityState={{
              selected: mode === assignmentMode,
              disabled: isBusy,
            }}
            testID={`lobby-assignment-mode-${mode.replaceAll("_", "-")}`}
            disabled={isBusy}
            onPress={() => onSelectMode(mode)}
            style={[
              styles.assignmentModeTab,
              mode === assignmentMode && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.assignmentModeLabel,
                mode === assignmentMode && { color: colors.textLight },
              ]}
            >
              {SHORT_LABELS[mode]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
