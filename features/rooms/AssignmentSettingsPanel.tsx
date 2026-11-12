import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  AssignmentCounter,
  AssignmentPanel,
  AssignmentRandomizer,
  AssignmentDefaultCount,
} from "../game-setup/AssignmentControls";
import createSetupGameStyles from "../game-setup/setupGameStyles";
import { useColors } from "../../styles/theme";
import {
  ASSIGNMENT_MODE,
  type AssignmentMode,
  type AssignmentPlan,
  type RoomAssignmentSettingsRequest,
} from "../../types/room";
import { DEFAULT_SHARED_MATCHES_PER_PAIR, MAX_ASSIGNMENT_COUNT } from "../../shared/assignments/types";
import AppIcon from "../../components/ui/AppIcon";

interface AssignmentSettingsPanelProps {
  plan: AssignmentPlan;
  mode: AssignmentMode;
  editing?: boolean;
  isBusy: boolean;
  onChange: (settings: RoomAssignmentSettingsRequest) => void;
  onRandomize?: () => void;
  hasRandomized?: boolean;
}

export function AssignmentSettingsPanel({
  plan,
  mode,
  editing = false,
  isBusy,
  onChange,
  onRandomize,
  hasRandomized,
}: AssignmentSettingsPanelProps): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const [showShared, setShowShared] = useState(false);
  if (mode === ASSIGNMENT_MODE.playerPicked) return <AssignmentDefaultCount value={plan.matchesPerPlayer} disabled={isBusy}
    testID="lobby-matches-per-player" onChange={matchesPerPlayer => onChange({ matchesPerPlayer, sharedMatchesPerPair: plan.sharedMatchesPerPair })} />;
  if (onRandomize) return <AssignmentRandomizer testID="lobby-assignment-settings" value={plan.matchesPerPlayer}
    disabled={isBusy} hasAssignments={hasRandomized} onRandomize={onRandomize}
    onChange={matchesPerPlayer => onChange({ matchesPerPlayer, sharedMatchesPerPair: DEFAULT_SHARED_MATCHES_PER_PAIR })} />;
  return <DefaultAssignmentSettings
    plan={plan}
    mode={mode}
    editing={editing}
    isBusy={isBusy}
    onChange={onChange}
    styles={styles}
    primaryColor={colors.primary}
    showShared={showShared}
    setShowShared={setShowShared}
  />;
}

interface DefaultAssignmentSettingsProps extends Pick<AssignmentSettingsPanelProps, "plan" | "mode" | "editing" | "isBusy" | "onChange"> {
  styles: ReturnType<typeof createSetupGameStyles>;
  primaryColor: ReturnType<typeof useColors>["primary"];
  showShared: boolean;
  setShowShared: React.Dispatch<React.SetStateAction<boolean>>;
}

function DefaultAssignmentSettings({ plan, mode, editing, isBusy, onChange, styles, primaryColor, showShared, setShowShared }:
  DefaultAssignmentSettingsProps): React.JSX.Element {
  return (
    <AssignmentPanel compact testID="lobby-assignment-settings">
      <AssignmentCounter
        label={plan.targetsByParticipantId ? "Default matches per player" : "Matches per player"}
        description="Plus the common match"
        value={plan.matchesPerPlayer}
        max={MAX_ASSIGNMENT_COUNT}
        disabled={isBusy}
        testID="lobby-matches-per-player"
        onChange={(matchesPerPlayer) =>
          onChange({
            matchesPerPlayer,
            sharedMatchesPerPair: plan.sharedMatchesPerPair,
          })
        }
      />
      {mode === ASSIGNMENT_MODE.automatic && plan.sharingPolicy === "exact" && plan.effectivePerPlayer > 0 &&
        plan.effectivePerPlayer < plan.sharedMatchesPerPair * Math.max(0, plan.participantCount - 1) ?
        <Text accessibilityRole="alert" style={styles.assignmentDescription}>
          Equal counts need at least {plan.sharedMatchesPerPair * Math.max(0, plan.participantCount - 1)} additional matches per player for this sharing setting. Increase the counts or choose individual counts.
        </Text> : null}
      {mode === ASSIGNMENT_MODE.automatic ? (
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
                color={primaryColor}
              />
              <Text style={styles.assignmentDescription}>
                Shared matches · {plan.sharedMatchesPerPair} per pair
              </Text>
            </View>
          </TouchableOpacity>
          {showShared ? (
            <AssignmentCounter
              label="Shared by each pair"
              description={plan.sharingPolicy === "preference" ? "Preferred shared matches per pair; individual counts stay fixed." : "Matches each pair of players shares, excluding the common match."}
              value={plan.sharedMatchesPerPair}
              max={MAX_ASSIGNMENT_COUNT}
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
      {mode === ASSIGNMENT_MODE.hostAssigned ? (
        <Text style={styles.assignmentDescription}>
          Open a player to assign their matches.
        </Text>
      ) : null}
    </AssignmentPanel>
  );
}
