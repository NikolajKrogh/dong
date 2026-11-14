import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";
import { formatMatchTime } from "../football-matches/matchTime";
import { TeamBadge } from "../football-matches/TeamBadge";
import type { SavedMatchTeam } from "../../types/footballMatch";
import AppIcon from "../../components/ui/AppIcon";

/**
 * The minimum a match needs to be rendered as selectable.
 *
 * Deliberately narrower than either the Zustand store's `Match` or the room
 * snapshot's `RoomMatchSummary`/`GuestRoomMatchSummary`, which do not unify
 * (`sourceProvider` is `string` in one and `string | null` in the other; likewise
 * the score fields). Every call site maps down to this shape, which is what lets
 * the solo setup flow and the multiplayer pick surfaces share one renderer.
 */
export interface SelectableMatch {
  catalogSnapshot?: import("../../types/footballMatch").SavedMatch;
  homeTeamDetails?: SavedMatchTeam;
  awayTeamDetails?: SavedMatchTeam;
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime?: string;
}

interface SelectableMatchListProps {
  /** Assignment density changes spacing, never the original card composition. */
  density?: "default" | "compact";
  matches: SelectableMatch[];
  selectedMatchIds: string[];
  onToggleMatch: (matchId: string) => void;
  /**
   * Matches that render visibly inert. Used for the player-picked cap: at the
   * limit the *unpicked* matches disable while picked ones stay tappable, so a
   * participant can always release one to make room (FR-040).
   */
  disabledMatchIds?: string[];
  /** Grid or list presentation. Owned by the caller so one toggle can drive several lists. */
  useGridLayout?: boolean;
  /** Per-match testIDs are emitted as `{testIDPrefix}-{matchId}` when provided. */
  testIDPrefix?: string;
  readOnly?: boolean;
}

interface SelectableMatchRowProps {
  density?: "default" | "compact";
  match: SelectableMatch;
  index: number;
  selected: boolean;
  disabled: boolean;
  testID?: string;
  compact: boolean;
  readOnly?: boolean;
  onToggleMatch: (matchId: string) => void;
}

interface SelectableMatchRowVisualProps extends Omit<SelectableMatchRowProps, "compact"> {
  density: "default" | "compact";
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createSetupGameStyles>;
  buttonStyle: React.ComponentProps<typeof TouchableOpacity>["style"];
  accessibilityState: { selected: boolean; checked: boolean; disabled: boolean };
  handlePress: () => void;
  gradientColors: React.ComponentProps<typeof LinearGradient>["colors"];
  kickoff: string | null;
}

const disabledMatchStyle = { opacity: 0.4 };
const gradientStart = { x: 0, y: 0 };
const gradientEnd = { x: 0, y: 1 };

const SelectableMatchRow = React.memo(function SelectableMatchRow({
  match,
  index,
  selected,
  disabled,
  testID,
  compact,
  density = "default",
  readOnly = false,
  onToggleMatch,
}: SelectableMatchRowProps) {
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const handlePress = React.useCallback(
    () => onToggleMatch(match.id),
    [match.id, onToggleMatch],
  );
  const accessibilityState = React.useMemo(
    () => ({ selected, checked: selected, disabled: disabled || readOnly }),
    [disabled, selected, readOnly],
  );
  const buttonStyle = React.useMemo(
    () => compact
      ? [
          styles.compactMatchItem,
          selected && styles.selectedCompactMatchItem,
          disabled && disabledMatchStyle,
        ]
      : [
          styles.matchCard,
          selected && styles.selectedMatchCard,
          styles.matchListItem,
          disabled && disabledMatchStyle,
        ],
    [compact, disabled, selected, styles],
  );
  const gradientColors = React.useMemo(
    () => [colors.primaryLighter, colors.surface] as const,
    [colors.primaryLighter, colors.surface],
  );
  const kickoff = React.useMemo(
    () => compact ? null : formatMatchTime(match.startTime),
    [compact, match.startTime],
  );

  const visualProps = {
    match, index, selected, disabled, testID, density, readOnly, onToggleMatch,
    colors, styles, buttonStyle, accessibilityState,
    handlePress, gradientColors, kickoff,
  };
  return compact
    ? <CompactSelectableMatchRow {...visualProps} />
    : <DetailedSelectableMatchRow {...visualProps} />;
});

function CompactSelectableMatchRow({ match, index, selected, disabled, testID, density, readOnly,
  colors, styles, buttonStyle, accessibilityState, handlePress,
  gradientColors }: SelectableMatchRowVisualProps): React.JSX.Element {
  return <TouchableOpacity testID={testID} accessibilityRole="checkbox" aria-checked={selected}
    accessibilityLabel={`${match.homeTeam} versus ${match.awayTeam}`} accessibilityState={accessibilityState}
    disabled={disabled || readOnly} style={buttonStyle} onPress={handlePress}>
    {density === "compact" && !selected ? <LinearGradient colors={gradientColors} start={gradientStart} end={gradientEnd} style={StyleSheet.absoluteFill} /> : null}
    <View style={styles.compactMatchNumberBadge}><Text style={styles.compactMatchNumberText}>{index + 1}</Text></View>
    {!readOnly ? <View style={[styles.selectionCheckmark, { top: 2, right: 2 }]}>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={14} color={selected ? colors.primary : colors.border} />
    </View> : null}
    <View style={styles.compactTeamsContainer}>
      <CompactTeamLogo matchName={match.homeTeam} team={match.catalogSnapshot?.homeTeam ?? match.homeTeamDetails} styles={styles} />
      <Text style={styles.compactVsText}>vs</Text>
      <CompactTeamLogo matchName={match.awayTeam} team={match.catalogSnapshot?.awayTeam ?? match.awayTeamDetails} styles={styles} />
    </View>
  </TouchableOpacity>;
}

function CompactTeamLogo({ matchName, team, styles }: {
  matchName: string;
  team?: SavedMatchTeam;
  styles: ReturnType<typeof createSetupGameStyles>;
}): React.JSX.Element {
  return <TeamBadge teamName={matchName} team={team} style={styles.compactTeamLogo} />;
}

function DetailedSelectableMatchRow({ match, index, selected, disabled, testID, density, readOnly,
  colors, styles, buttonStyle, accessibilityState, handlePress, gradientColors,
  kickoff }: SelectableMatchRowVisualProps): React.JSX.Element {
  return <TouchableOpacity testID={testID} accessibilityRole="checkbox" aria-checked={selected}
    accessibilityState={accessibilityState} accessibilityLabel={`${match.homeTeam} versus ${match.awayTeam}`}
    disabled={disabled || readOnly} style={buttonStyle} onPress={handlePress}>
    <View style={styles.matchNumberBadge}><Text style={styles.matchNumberText}>{index + 1}</Text></View>
    <LinearGradient colors={gradientColors} start={gradientStart} end={gradientEnd}
      style={[styles.matchCardGradient, density === "compact" && styles.assignmentCardGradient]}>
      <View style={styles.matchTeamsContainer}>
        <DetailedTeamColumn matchName={match.homeTeam} team={match.catalogSnapshot?.homeTeam ?? match.homeTeamDetails} density={density} styles={styles} />
        <View style={styles.vsDividerHorizontal}><Text style={styles.vsText}>VS</Text></View>
        <DetailedTeamColumn matchName={match.awayTeam} team={match.catalogSnapshot?.awayTeam ?? match.awayTeamDetails} density={density} styles={styles} />
      </View>
      {kickoff ? <View style={[styles.matchTimeHeader, density === "compact" && styles.assignmentCardKickoff]}>
        <AppIcon name="time-outline" size={16} color={density === "compact" ? colors.primaryDark : colors.primary} />
        <Text style={[styles.matchTimeText, density === "compact" && styles.assignmentCardKickoffText]}>{kickoff}</Text>
      </View> : null}
      {!readOnly ? <View style={styles.selectionCheckmark}>
        <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24}
          color={selected ? colors.primary : colors.border} />
      </View> : null}
    </LinearGradient>
  </TouchableOpacity>;
}

function DetailedTeamColumn({ matchName, team, density, styles }: {
  matchName: string;
  team?: SavedMatchTeam;
  density: "default" | "compact";
  styles: ReturnType<typeof createSetupGameStyles>;
}): React.JSX.Element {
  return <View style={styles.matchTeamColumn}>
    <View style={[styles.logoContainer, density === "compact" && styles.assignmentCardLogo]}>
      <TeamBadge teamName={matchName} team={team} style={[styles.teamLogo, density === "compact" && styles.assignmentCardTeamLogo]} />
    </View>
    <Text style={[styles.teamName, density === "compact" && styles.assignmentCardTeamName]}>{matchName}</Text>
  </View>;
}

const matchKeyExtractor = (match: SelectableMatch) => match.id;

/**
 * A tappable list of matches, in grid or list form.
 *
 * Extracted verbatim from `components/setupGame/AssignmentSection.tsx` so the
 * solo setup flow, the lobby, and the guest surface all present match selection
 * the same way (specs/022-player-picked-mode/research.md R15). Presentation only:
 * it owns no selection state and makes no decisions about what selection means.
 */
export const SelectableMatchList: React.FC<SelectableMatchListProps> = ({
  matches,
  selectedMatchIds,
  onToggleMatch,
  disabledMatchIds,
  useGridLayout = false,
  density = "default",
  testIDPrefix,
  readOnly = false,
}) => {
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const selectedMatchSet = React.useMemo(() => new Set(selectedMatchIds), [selectedMatchIds]);
  const disabledMatchSet = React.useMemo(
    () => new Set(disabledMatchIds ?? []),
    [disabledMatchIds],
  );
  const getTestID = React.useCallback(
    (matchId: string) => testIDPrefix ? `${testIDPrefix}-${matchId}` : undefined,
    [testIDPrefix],
  );
  const renderMatchRow = React.useCallback((match: SelectableMatch, index: number, compact: boolean) => (
    <SelectableMatchRow
      key={match.id}
      match={match}
      index={index}
      selected={selectedMatchSet.has(match.id)}
      disabled={disabledMatchSet.has(match.id)}
      testID={getTestID(match.id)}
      compact={compact}
      density={density}
      readOnly={readOnly}
      onToggleMatch={onToggleMatch}
    />
  ), [disabledMatchSet, getTestID, onToggleMatch, selectedMatchSet, readOnly, density]);
  const renderCompactMatchItem = React.useCallback((match: SelectableMatch, index: number) => (
    <View key={match.id} style={styles.gridItem}>
      {renderMatchRow(match, index, true)}
    </View>
  ), [renderMatchRow, styles.gridItem]);
  const renderMatch = React.useCallback(({ item, index }: { item: SelectableMatch; index: number }) =>
    renderMatchRow(item, index, false), [renderMatchRow]);

  if (useGridLayout) {
    return (
      <View style={styles.gridContainer}>
        {matches.map(renderCompactMatchItem)}
      </View>
    );
  }

  // Disabled web ScrollViews set touch-action:none and block the parent's swipe.
  if (Platform.OS === "web") {
    return <View>{matches.map((item, index) => renderMatch({ item, index }))}</View>;
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={matchKeyExtractor}
      numColumns={1}
      renderItem={renderMatch}
      scrollEnabled={false}
    />
  );
};
