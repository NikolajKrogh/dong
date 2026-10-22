import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { AssignmentMode } from "../../types/room";
import { ASSIGNMENT_MODE_LABELS } from "../../types/room";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";

const MODES = ["automatic", "host_assigned", "player_picked"] as const;
const SHORT_LABELS = {
  automatic: "Automatic",
  host_assigned: "Host assigns",
  player_picked: "Players pick",
};
interface AssignmentModeSelectorProps {
  assignmentMode: AssignmentMode;
  isBusy: boolean;
  onSelectMode: (mode: AssignmentMode) => void;
}

export function AssignmentModeSelector({
  assignmentMode,
  isBusy,
  onSelectMode,
}: AssignmentModeSelectorProps): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  return (
    <View testID="lobby-assignment-mode">
      <Text style={styles.filterSectionTitle}>Assignment mode</Text>
      <View style={styles.assignmentModeTabs}>
        {MODES.map((mode) => (
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
