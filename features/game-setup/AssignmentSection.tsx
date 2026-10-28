import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout as isWideViewport } from "../../styles/responsive";
import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";
import { Match, Player } from "../../store/gameStore";
import { AssignmentCounter, AssignmentInfoModal, AssignmentPanel } from "./AssignmentControls";
import { MatchSelectionCard } from "./MatchSelectionCard";
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
  /** Function to set the number of matches per player for random assignment. */
  setMatchesPerPlayer: (count: number) => void;
  /**
   * Function to handle random assignment of matches to players.
   * @param {number} numMatches - Number of matches to assign to each player.
   */
  handleRandomAssignment: (numMatches: number) => void;
}

interface RandomAssignmentSectionProps {
  playerCount: number;
  matchCount: number;
  commonMatchId: string | null;
  matchesPerPlayer: number;
  setMatchesPerPlayer: (count: number) => void;
  onRandomAssignment: (count: number) => void;
  styles: ReturnType<typeof createSetupGameStyles>;
  colors: ReturnType<typeof useColors>;
}

function RandomAssignmentSection({
  playerCount,
  matchCount,
  commonMatchId,
  matchesPerPlayer,
  setMatchesPerPlayer,
  onRandomAssignment,
  styles,
  colors,
}: RandomAssignmentSectionProps): React.JSX.Element | null {
  if (playerCount === 0 || matchCount === 0 || !commonMatchId) return null;

  return (
    <AssignmentPanel
      title="Random Assignment"
      help="Randomly assign matches to players. Each player will share exactly one match with every other player."
    >
      <AssignmentCounter
        label="Matches per player:"
        value={matchesPerPlayer}
        min={1}
        max={matchCount - 1}
        onChange={setMatchesPerPlayer}
      />
      <TouchableOpacity
        style={styles.randomizeButton}
        onPress={() => onRandomAssignment(matchesPerPlayer)}
      >
        <Ionicons name="shuffle" size={20} color={colors.primaryLight} />
        <Text style={styles.randomizeButtonText}>Randomize Matches</Text>
      </TouchableOpacity>
    </AssignmentPanel>
  );
}

interface ManualAssignmentSectionProps {
  players: Player[];
  matchCount: number;
  commonMatchId: string | null;
  nonCommonMatchCount: number;
  selectableMatches: SelectableMatch[];
  playerAssignments: { [playerId: string]: string[] };
  collapsedPlayers: Record<string, boolean>;
  isWideLayout: boolean;
  useGridLayout: boolean;
  onToggleCollapse: (playerId: string) => void;
  onToggleAssignment: (playerId: string, matchId: string) => void;
  onToggleLayout: () => void;
  modalVisible: boolean;
  onToggleModal: () => void;
  styles: ReturnType<typeof createSetupGameStyles>;
  colors: ReturnType<typeof useColors>;
}

const ManualAssignmentSection = ({
  players,
  matchCount,
  commonMatchId,
  nonCommonMatchCount,
  selectableMatches,
  playerAssignments,
  collapsedPlayers,
  isWideLayout,
  useGridLayout,
  onToggleCollapse,
  onToggleAssignment,
  onToggleLayout,
  modalVisible,
  onToggleModal,
  styles,
  colors,
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
          <TouchableOpacity onPress={onToggleLayout} style={styles.layoutToggleButton}>
            <Ionicons
              name={useGridLayout ? "list" : "grid"}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggleModal}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <AssignmentInfoModal
        visible={modalVisible}
        message="Tap on matches below to select which matches each player will drink for."
        onClose={onToggleModal}
        styles={styles}
      />

      <View
        testID="AssignmentPlayersGrid"
        style={[
          styles.assignmentPlayersGrid,
          isWideLayout && styles.assignmentPlayersGridWide,
        ]}
      >
        {players.map((player) => (
          <MatchSelectionCard
            key={player.id}
            testID="AssignmentPlayerCard"
            style={[
              styles.assignmentContainer,
              styles.playerContainer,
              isWideLayout && styles.assignmentPlayerCardWide,
            ]}
            title={player.name}
            selectedCount={getAssignmentCount(player.id)}
            totalCount={nonCommonMatchCount}
            collapsed={collapsedPlayers[player.id] ?? true}
            onToggleCollapsed={() => onToggleCollapse(player.id)}
          >
            <SelectableMatchList
              key={`${useGridLayout ? "grid" : "list"}-${player.id}`}
              matches={selectableMatches}
              selectedMatchIds={playerAssignments[player.id] ?? []}
              onToggleMatch={(matchId) => onToggleAssignment(player.id, matchId)}
              useGridLayout={useGridLayout}
            />
          </MatchSelectionCard>
        ))}
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
  /** State to control the visibility of the manual assignment info modal. */
  const [isModalVisible, setIsModalVisible] = useState(false);
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
   * Toggles the visibility of the manual assignment info modal.
   *
   * @function
   * @returns {void}
   */
  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

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
      startTime: match.startTime,
    }),
  );

  return (
    <View style={baseStyles.tabContent}>
      <RandomAssignmentSection
        playerCount={players.length}
        matchCount={matches.length}
        commonMatchId={commonMatchId}
        matchesPerPlayer={matchesPerPlayer}
        setMatchesPerPlayer={setMatchesPerPlayer}
        onRandomAssignment={handleRandomAssignment}
        styles={baseStyles}
        colors={colors}
      />
      <ManualAssignmentSection
        players={players}
        matchCount={matches.length}
        commonMatchId={commonMatchId}
        nonCommonMatchCount={nonCommonMatches.length}
        selectableMatches={selectableMatches}
        playerAssignments={playerAssignments}
        collapsedPlayers={collapsedPlayers}
        isWideLayout={isWideLayout}
        useGridLayout={useGridLayout}
        onToggleCollapse={togglePlayerCollapse}
        onToggleAssignment={toggleMatchAssignment}
        onToggleLayout={toggleLayoutMode}
        modalVisible={isModalVisible}
        onToggleModal={toggleModal}
        styles={baseStyles}
        colors={colors}
      />
    </View>
  );
};

export default AssignmentSection;
