import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  AssignmentCounter,
  AssignmentPanel,
} from "../../features/game-setup/AssignmentControls";
import createSetupGameStyles from "../../features/game-setup/setupGameStyles";
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
  editing?: boolean;
  isBusy: boolean;
  onChange: (settings: RoomAssignmentSettingsRequest) => void;
}

export function AssignmentSettingsPanel({
  plan,
  mode,
  editing = false,
  isBusy,
  onChange,
}: AssignmentSettingsPanelProps): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const [showShared, setShowShared] = useState(false);
  return (
    <AssignmentPanel compact testID="lobby-assignment-settings">
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
              description="Matches each pair of players shares, excluding the common match."
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
            {editing ? "Matches are redistributed when you save changes." : "Matches are assigned when you start the game."}
          </Text>
        </>
      ) : null}
      {mode === "host_assigned" ? (
        <Text style={styles.assignmentDescription}>
          Open a player to assign their matches.
        </Text>
      ) : null}
    </AssignmentPanel>
  );
}
