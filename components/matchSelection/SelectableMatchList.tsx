import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";
import { formatMatchTime } from "../../utils/matchTime";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import AppIcon from "../AppIcon";

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
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime?: string;
}

interface SelectableMatchListProps {
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
}

interface SelectableMatchRowProps {
  match: SelectableMatch;
  index: number;
  selected: boolean;
  disabled: boolean;
  testID?: string;
  compact: boolean;
  onToggleMatch: (matchId: string) => void;
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
  onToggleMatch,
}: SelectableMatchRowProps) {
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const handlePress = React.useCallback(
    () => onToggleMatch(match.id),
    [match.id, onToggleMatch],
  );
  const accessibilityState = React.useMemo(
    () => ({ selected, disabled }),
    [disabled, selected],
  );
  const homeTeamLogo = getTeamLogoWithFallback(match.homeTeam);
  const awayTeamLogo = getTeamLogoWithFallback(match.awayTeam);
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

  if (compact) {
    return (
      <TouchableOpacity
        testID={testID}
        accessibilityState={accessibilityState}
        disabled={disabled}
        style={buttonStyle}
        onPress={handlePress}
      >
        <View style={styles.compactMatchNumberBadge}>
          <Text style={styles.compactMatchNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.compactTeamsContainer}>
          {homeTeamLogo ? (
            <Image source={homeTeamLogo} style={styles.compactTeamLogo} resizeMode="contain" />
          ) : (
            <View style={styles.compactTeamPlaceholder}>
              <Text style={styles.compactTeamPlaceholderText}>{match.homeTeam.charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.compactVsText}>vs</Text>
          {awayTeamLogo ? (
            <Image source={awayTeamLogo} style={styles.compactTeamLogo} resizeMode="contain" />
          ) : (
            <View style={styles.compactTeamPlaceholder}>
              <Text style={styles.compactTeamPlaceholderText}>{match.awayTeam.charAt(0)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityState={accessibilityState}
      disabled={disabled}
      style={buttonStyle}
      onPress={handlePress}
    >
      <View style={styles.matchNumberBadge}>
        <Text style={styles.matchNumberText}>{index + 1}</Text>
      </View>
      <LinearGradient
        colors={gradientColors}
        start={gradientStart}
        end={gradientEnd}
        style={styles.matchCardGradient}
      >
        <View style={styles.matchTeamsContainer}>
          <View style={styles.matchTeamColumn}>
            <View style={styles.logoContainer}>
              {homeTeamLogo ? (
                <Image source={homeTeamLogo} style={styles.teamLogo} />
              ) : (
                <View style={styles.teamLogoPlaceholder}>
                  <Text style={styles.teamLogoPlaceholderText}>{match.homeTeam.charAt(0)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">
              {match.homeTeam}
            </Text>
          </View>
          <View style={styles.vsDividerHorizontal}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.matchTeamColumn}>
            <View style={styles.logoContainer}>
              {awayTeamLogo ? (
                <Image source={awayTeamLogo} style={styles.teamLogo} />
              ) : (
                <View style={styles.teamLogoPlaceholder}>
                  <Text style={styles.teamLogoPlaceholderText}>{match.awayTeam.charAt(0)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">
              {match.awayTeam}
            </Text>
          </View>
        </View>
        {kickoff ? (
          <View style={styles.matchTimeHeader}>
            <AppIcon name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.matchTimeText}>{kickoff}</Text>
          </View>
        ) : null}
        <View style={styles.selectionCheckmark}>
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={selected ? colors.primary : colors.border}
          />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

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
  testIDPrefix,
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
  const renderCompactMatchItem = React.useCallback((match: SelectableMatch, index: number) => (
    <View key={match.id} style={styles.gridItem}>
      <SelectableMatchRow
        match={match}
        index={index}
        selected={selectedMatchSet.has(match.id)}
        disabled={disabledMatchSet.has(match.id)}
        testID={getTestID(match.id)}
        compact
        onToggleMatch={onToggleMatch}
      />
    </View>
  ), [disabledMatchSet, getTestID, onToggleMatch, selectedMatchSet, styles.gridItem]);
  const renderMatch = React.useCallback(({ item, index }: { item: SelectableMatch; index: number }) => (
    <SelectableMatchRow
      match={item}
      index={index}
      selected={selectedMatchSet.has(item.id)}
      disabled={disabledMatchSet.has(item.id)}
      testID={getTestID(item.id)}
      compact={false}
      onToggleMatch={onToggleMatch}
    />
  ), [disabledMatchSet, getTestID, onToggleMatch, selectedMatchSet]);

  if (useGridLayout) {
    return (
      <View style={styles.gridContainer}>
        {matches.map(renderCompactMatchItem)}
      </View>
    );
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
