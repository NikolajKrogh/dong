import React, { useState } from "react";
import {
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout as isWideViewport } from "../../styles/responsive";
import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";
import { Match, Player } from "../../store/gameStore";
import { COMMON_MATCH_COUNT, MAX_ASSIGNMENT_COUNT } from "../../shared/assignments/types";
import { AssignmentRandomizer } from "./AssignmentControls";
import { AssignmentPlayerCard, AssignmentLayoutToggle } from "./AssignmentPlayerCard";
import {
  SelectableMatchList,
  type SelectableMatch,
} from "./SelectableMatchList";

/**
 * Props for the AssignmentSection component.
 * @interface AssignmentSectionProps
 */
interface AssignmentSectionProps {
  /** Array of players in the game. */
  players: Player[];
  /** Array of matches available for assignment. */
  matches: Match[];
  /** ID of the common match, if any. Used for shared match that all players drink for. */
  commonMatchId: string | null;
  /** Object mapping player IDs to an array of assigned match IDs. */
  playerAssignments: { [playerId: string]: string[] };
  /** Function to toggle a match assignment for a player. */
  toggleMatchAssignment: (playerId: string, matchId: string) => void;
  /** Number of matches to be assigned per player in random assignment. */
  matchesPerPlayer: number;
  playerMatchCounts?: Record<string, number>;
  setPlayerMatchCount?: (playerId: string, count: number | null) => void;
  isAssigning?: boolean;
  /** Function to set the number of matches per player for random assignment. */
  setMatchesPerPlayer: (count: number) => void;
  /**
   * Function to handle random assignment of matches to players.
   * @param {number} numMatches - Number of matches to assign to each player.
   */
  handleRandomAssignment: (numMatches: number) => void;
}

interface ManualAssignmentSectionProps {
  matchesPerPlayer: number;
  playerMatchCounts: Record<string, number>;
  setPlayerMatchCount?: (playerId: string, count: number | null) => void;
  isAssigning?: boolean;
  players: Player[];
  matchCount: number;
  commonMatchId: string | null;

  selectableMatches: SelectableMatch[];
  playerAssignments: { [playerId: string]: string[] };
  collapsedPlayers: Record<string, boolean>;
  isWideLayout: boolean;
  useGridLayout: boolean;
  onToggleCollapse: (playerId: string) => void;
  onToggleAssignment: (playerId: string, matchId: string) => void;
  onToggleLayout: () => void;
  styles: ReturnType<typeof createSetupGameStyles>;
}

const ManualAssignmentSection = ({
  matchesPerPlayer,
  playerMatchCounts,
  setPlayerMatchCount,
  isAssigning,
  players,
  matchCount,
  commonMatchId,
  selectableMatches,
  playerAssignments,
  collapsedPlayers,
  isWideLayout,
  useGridLayout,
  onToggleCollapse,
  onToggleAssignment,
  onToggleLayout,
  styles,
}: ManualAssignmentSectionProps) => {
  if (players.length === 0 || matchCount === 0) return null;

  const getAssignmentCount = (playerId: string) =>
    (playerAssignments[playerId] ?? []).filter((matchId) =>
      matchId !== commonMatchId,
    ).length;

  return (
    <View style={styles.assignmentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Manual Assignment</Text>
        <View style={styles.headerActionsRow}>
          <AssignmentLayoutToggle grid={useGridLayout} onToggle={onToggleLayout} />

        </View>
      </View>

      <View
        testID="AssignmentPlayersGrid"
        style={[
          styles.assignmentPlayersGrid,
          isWideLayout && styles.assignmentPlayersGridWide,
        ]}
      >
        {players.map((player) => {
          return (
          <AssignmentPlayerCard
            key={player.id}
            testID="AssignmentPlayerCard"
            style={[
              isWideLayout && styles.assignmentPlayerCardWide,
            ]}
            target={playerMatchCounts[player.id] ?? matchesPerPlayer}
            defaultCount={matchesPerPlayer}
            onSetCount={setPlayerMatchCount ? count => setPlayerMatchCount(player.id, count) : undefined}
            usesDefault={playerMatchCounts[player.id] === undefined}
            disabled={isAssigning}
            title={player.name}
            selectedCount={getAssignmentCount(player.id)}
            totalCount={playerMatchCounts[player.id] ?? matchesPerPlayer}
            collapsed={collapsedPlayers[player.id] ?? true}
            onToggleCollapsed={() => onToggleCollapse(player.id)}
          >
            <SelectableMatchList
              density="compact"
              key={`${useGridLayout ? "grid" : "list"}-${player.id}`}
              matches={selectableMatches}
              selectedMatchIds={playerAssignments[player.id] ?? []}
              onToggleMatch={(matchId) => onToggleAssignment(player.id, matchId)}
              useGridLayout={useGridLayout}
            />
          </AssignmentPlayerCard>
          );
        })}
      </View>
    </View>
  );
};

/**
 * Component for assigning matches to players, either manually or randomly.
 *
 * This component displays a list of players and allows the user to assign matches
 * to each player. It supports both manual selection of matches and a random
 * assignment feature. It also allows toggling between list and grid views for matches.
 * Players can collapse their match lists for better organization.
 *
 * @component
 * @param {AssignmentSectionProps} props - The props for the component.
 * @returns {JSX.Element} The AssignmentSection component.
 */
const AssignmentSection: React.FC<AssignmentSectionProps> = ({
  players,
  matches,
  commonMatchId,
  playerAssignments,
  toggleMatchAssignment,
  matchesPerPlayer,
  playerMatchCounts = {},
  setPlayerMatchCount,
  isAssigning,
  setMatchesPerPlayer,
  handleRandomAssignment,
}) => {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const baseStyles = React.useMemo(
    () => createSetupGameStyles(colors),
    [colors],
  );
  const isWideLayout = isWideViewport(width);

  /**
   * State to track the current layout mode (grid or list).
   * @type {boolean} False for list view, true for grid view.
   */
  const [useGridLayout, setUseGridLayout] = useState(false);
  /** State to track which players' match lists are collapsed. */
  const [collapsedPlayers, setCollapsedPlayers] = useState<
    Record<string, boolean>
  >(() => {
    const initialState: Record<string, boolean> = {};
    players.forEach((player) => {
      initialState[player.id] = true; // true = collapsed
    });
    return initialState;
  });

  /**
   * Toggles the layout mode between grid and list view for matches.
   *
   * @function
   * @returns {void}
   */
  const toggleLayoutMode = () => {
    setUseGridLayout(!useGridLayout);
  };

  /**
   * Toggles the collapsed state of a player's match list.
   *
   * @function
   * @param {string} playerId - The ID of the player.
   * @returns {void}
   */
  const togglePlayerCollapse = (playerId: string) => {
    setCollapsedPlayers((prev) => ({
      ...prev,
      [playerId]: !(prev[playerId] ?? true),
    }));
  };

  /**
   * Filters out the common match from the list of all matches.
   * Common match is excluded from the manual assignment section as it's assigned to all players.
   */
  const nonCommonMatches = matches.filter(
    (match) => match.id !== commonMatchId,
  );

  /**
   * Maps the store's `Match` down to the shared renderer's view-model. The
   * card/grid markup now lives in `components/matchSelection/` so the lobby and
   * guest pick surfaces present matches identically (specs/022-player-picked-mode
   * research.md R15); this flow's behaviour is unchanged.
   */
  const selectableMatches: SelectableMatch[] = nonCommonMatches.map(
    (match) => ({
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamDetails: match.homeTeamDetails,
      awayTeamDetails: match.awayTeamDetails,
      catalogSnapshot: match.catalogSnapshot,
      startTime: match.startTime,
    }),
  );

  return (
    <View style={baseStyles.tabContent}>
      {players.length > 0 && matches.length > 0 && commonMatchId ? <AssignmentRandomizer
        value={matchesPerPlayer}
        max={Math.min(MAX_ASSIGNMENT_COUNT, matches.length - COMMON_MATCH_COUNT)}
        disabled={isAssigning}
        onChange={setMatchesPerPlayer}
        onRandomize={() => handleRandomAssignment(matchesPerPlayer)}
        hasAssignments={Object.values(playerAssignments).some(ids => ids.some(id => id !== commonMatchId))}
      /> : null}
      <ManualAssignmentSection
        matchesPerPlayer={matchesPerPlayer}
        playerMatchCounts={playerMatchCounts}
        setPlayerMatchCount={setPlayerMatchCount}
        isAssigning={isAssigning}
        players={players}
        matchCount={matches.length}
        commonMatchId={commonMatchId}

        selectableMatches={selectableMatches}
        playerAssignments={playerAssignments}
        collapsedPlayers={collapsedPlayers}
        isWideLayout={isWideLayout}
        useGridLayout={useGridLayout}
        onToggleCollapse={togglePlayerCollapse}
        onToggleAssignment={toggleMatchAssignment}
        onToggleLayout={toggleLayoutMode}

        styles={baseStyles}
      />
    </View>
  );
};

export default AssignmentSection;
