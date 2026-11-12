import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ASSIGNMENT_MODE, type AssignmentMode } from "../../types/room";
import { AssignmentInfoModal } from "../game-setup/AssignmentControls";
import AppIcon from "../../components/ui/AppIcon";
import createSetupGameStyles from "../game-setup/setupGameStyles";
import { useColors } from "../../styles/theme";

const SHORT_LABELS = {
  [ASSIGNMENT_MODE.automatic]: "Automatic",
  [ASSIGNMENT_MODE.hostAssigned]: "Host assigns",
  [ASSIGNMENT_MODE.playerPicked]: "Players pick",
};
const MODE_HELP: Record<AssignmentMode, string> = {
  [ASSIGNMENT_MODE.automatic]:
    "Matches are distributed automatically when you confirm the assignments. Everyone gets the common match. Use Shared matches to control how many additional matches each pair shares.",
  [ASSIGNMENT_MODE.hostAssigned]:
    "Open a player to assign their matches. Everyone gets the common match.",
  [ASSIGNMENT_MODE.playerPicked]:
    "Each player chooses their own matches. You can follow their progress below. Everyone gets the common match.",
};

interface AssignmentModeSelectorProps {
  assignmentMode: AssignmentMode;
  allowPlayerPicked?: boolean;
  isBusy: boolean;
  showHelp?: boolean;
  onSelectMode: (mode: AssignmentMode) => void;
}

export function AssignmentModeSelector({
  assignmentMode,
  allowPlayerPicked = true,
  isBusy,
  onSelectMode,
  showHelp: allowHelp = true,
}: AssignmentModeSelectorProps): React.JSX.Element {
  const [showHelp, setShowHelp] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  return (
    <View testID="lobby-assignment-mode">
      {allowHelp ? <View style={styles.sectionHeader}>
        <Text style={styles.filterSectionTitle}>Assignment mode</Text>
        {allowHelp ? <TouchableOpacity
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
        </TouchableOpacity> : null}
      </View> : null}
      <AssignmentInfoModal
        visible={showHelp}
        message={MODE_HELP[assignmentMode]}
        onClose={() => setShowHelp(false)}
      />
      <View style={styles.assignmentModeTabs}>
        {Object.values(ASSIGNMENT_MODE).filter(mode => allowPlayerPicked || mode !== ASSIGNMENT_MODE.playerPicked).map((mode) => (
          <TouchableOpacity
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={SHORT_LABELS[mode]}
            aria-pressed={mode === assignmentMode}
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
