import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  AssignmentCounter,
  AssignmentPanel,
} from "../setupGame/AssignmentControls";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";
import type {
  AssignmentMode,
  AssignmentPlan,
  RoomAssignmentSettingsRequest,
} from "../../types/room";
import AppIcon from "../AppIcon";

interface AssignmentSettingsPanelProps {
  plan: AssignmentPlan;
  mode: AssignmentMode;
  isBusy: boolean;
  onChange: (settings: RoomAssignmentSettingsRequest) => void;
}

const TITLES: Record<AssignmentMode, string> = {
  automatic: "Random Assignment",
  host_assigned: "Manual Assignment",
  player_picked: "Player Picks",
};
const HELP: Record<AssignmentMode, string> = {
  automatic:
    "Matches are assigned automatically when the host starts the game. Shared matches control how many fixtures each pair of players watches together.",
  host_assigned:
    "Open a player below to assign their matches. Everyone gets the common match too.",
  player_picked:
    "Each player chooses their own matches. You can follow their progress below. Everyone gets the common match too.",
};

export function AssignmentSettingsPanel({
  plan,
  mode,
  isBusy,
  onChange,
}: AssignmentSettingsPanelProps): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const [showShared, setShowShared] = useState(false);
  return (
    <AssignmentPanel
      compact
      title={TITLES[mode]}
      help={HELP[mode]}
      testID="lobby-assignment-settings"
    >
      <AssignmentCounter
        label="Matches per player"
        description="Plus the common match"
        value={plan.matchesPerPlayer}
        disabled={isBusy}
        testID="lobby-matches-per-player"
        onChange={(matchesPerPlayer) =>
          onChange({
            matchesPerPlayer,
            sharedMatchesPerPair: plan.sharedMatchesPerPair,
          })
        }
      />
      {mode === "automatic" ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: showShared }}
            style={styles.filterSummaryButton}
            onPress={() => setShowShared((value) => !value)}
            testID="lobby-shared-matches-toggle"
          >
            <View style={styles.filterSummaryRow}>
              <AppIcon
                name={showShared ? "chevron-down" : "chevron-forward"}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.assignmentDescription}>
                Shared matches · {plan.sharedMatchesPerPair} per pair
              </Text>
            </View>
          </TouchableOpacity>
          {showShared ? (
            <AssignmentCounter
              label="Shared by each pair"
              value={plan.sharedMatchesPerPair}
              disabled={isBusy}
              testID="lobby-shared-matches-per-pair"
              onChange={(sharedMatchesPerPair) =>
                onChange({
                  matchesPerPlayer: plan.matchesPerPlayer,
                  sharedMatchesPerPair,
                })
              }
            />
          ) : null}
          <Text style={styles.assignmentDescription}>
            Matches are assigned when you start the game.
          </Text>
        </>
      ) : null}
    </AssignmentPanel>
  );
}

export const AssignmentRequirementLine: React.FC<{ plan: AssignmentPlan }> = ({
  plan,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  return (
    <Text
      testID="lobby-assignment-requirement"
      style={styles.assignmentDescription}
    >
      {plan.effectivePerPlayer} extra{" "}
      {plan.effectivePerPlayer === 1 ? "match" : "matches"} each · 1 common
      match
    </Text>
  );
};
