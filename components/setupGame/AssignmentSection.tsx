import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout as isWideViewport } from "../../app/style/responsive";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import { Match, Player } from "../../store/store";
import { MatchSelectionCard } from "../matchSelection/MatchSelectionCard";
import {
  SelectableMatchList,
  type SelectableMatch,
} from "../matchSelection/SelectableMatchList";

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
  /** State to control the visibility of the random assignment info modal. */
  const [isRandomModalVisible, setIsRandomModalVisible] = useState(false);
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
   * Effect to update the collapsed state of players when the players prop changes.
   * Ensures new players are initially collapsed.
   *
   * @effect
   * @dependencyArray {players} Re-runs when players array changes
   */
  React.useEffect(() => {
    setCollapsedPlayers((prev) => {
      const updated = { ...prev };
      players.forEach((player) => {
        updated[player.id] ??= true;
      });
      return updated;
    });
  }, [players]);

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
   * Toggles the visibility of the random assignment info modal.
   *
   * @function
   * @returns {void}
   */
  const toggleRandomModal = () => {
    setIsRandomModalVisible(!isRandomModalVisible);
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
      [playerId]: !prev[playerId],
    }));
  };

  /** Instructional text for manual match assignment. */
  const instructionText =
    "Tap on matches below to select which matches each player will drink for.";

  /** Instructional text for random match assignment. */
  const randomInstructionText =
    "Randomly assign matches to players. Each player will share exactly one match with every other player.";

  /**
   * Calculates the number of non-common matches assigned to a player.
   * Used to display the assignment count in the player badge.
   *
   * @function
   * @param {string} playerId - The ID of the player.
   * @returns {number} The count of assigned non-common matches.
   */
  const getAssignmentCount = (playerId: string) => {
    const playerMatches = playerAssignments[playerId] || [];
    return playerMatches.filter((matchId) => matchId !== commonMatchId).length;
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

  /**
   * Renders the shared selectable match list for one player, in grid or list
   * form. The card/grid markup itself now lives in
   * `components/matchSelection/SelectableMatchList`.
   */
  const renderMatches = (player: Player) => (
    <SelectableMatchList
      key={`${useGridLayout ? "grid" : "list"}-${player.id}`}
      matches={selectableMatches}
      selectedMatchIds={playerAssignments[player.id] ?? []}
      onToggleMatch={(matchId) => toggleMatchAssignment(player.id, matchId)}
      useGridLayout={useGridLayout}
    />
  );

  return (
    <View style={baseStyles.tabContent}>
      {/* Random Assignment Section */}
      {players.length > 0 && matches.length > 0 && commonMatchId && (
        <View style={[baseStyles.assignmentSection, { marginBottom: 16 }]}>
          <View style={baseStyles.sectionHeader}>
            <Text style={baseStyles.sectionTitle}>Random Assignment</Text>
            <TouchableOpacity onPress={toggleRandomModal}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          <Modal
            animationType="slide"
            transparent={true}
            visible={isRandomModalVisible}
            onRequestClose={toggleRandomModal}
          >
            <View style={baseStyles.centeredView}>
              <View style={baseStyles.modalView}>
                <Text style={baseStyles.modalText}>
                  {randomInstructionText}
                </Text>
                <TouchableOpacity
                  style={[baseStyles.button, baseStyles.buttonCancel]}
                  onPress={toggleRandomModal}
                >
                  <Text style={baseStyles.textStyle}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={baseStyles.randomizeContainer}>
            <View style={baseStyles.matchCounterContainer}>
              <Text style={baseStyles.matchCountLabel}>
                Matches per player:
              </Text>
              <View style={baseStyles.counter}>
                <TouchableOpacity
                  style={baseStyles.counterButton}
                  onPress={() =>
                    setMatchesPerPlayer(Math.max(1, matchesPerPlayer - 1))
                  }
                >
                  <Ionicons
                    name="remove-outline"
                    size={20}
                    color={colors.primaryLight}
                  />
                </TouchableOpacity>
                <Text style={baseStyles.counterValue}>{matchesPerPlayer}</Text>
                <TouchableOpacity
                  style={baseStyles.counterButton}
                  onPress={() =>
                    setMatchesPerPlayer(
                      Math.min(matchesPerPlayer + 1, matches.length - 1),
                    )
                  }
                >
                  <Ionicons
                    name="add-outline"
                    size={20}
                    color={colors.primaryLight}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={baseStyles.randomizeButton}
              onPress={() => handleRandomAssignment(matchesPerPlayer)}
            >
              <Ionicons name="shuffle" size={20} color={colors.primaryLight} />
              <Text style={baseStyles.randomizeButtonText}>
                Randomize Matches
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manual Assignment Section */}
      {players.length > 0 && matches.length > 0 && (
        <View style={baseStyles.assignmentSection}>
          <View style={baseStyles.sectionHeader}>
            <Text style={baseStyles.sectionTitle}>Manual Assignment</Text>
            <View style={baseStyles.headerActionsRow}>
              <TouchableOpacity
                onPress={toggleLayoutMode}
                style={baseStyles.layoutToggleButton}
              >
                <Ionicons
                  name={useGridLayout ? "list" : "grid"}
                  size={22}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleModal}>
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Modal
            animationType="slide"
            transparent={true}
            visible={isModalVisible}
            onRequestClose={toggleModal}
          >
            <View style={baseStyles.centeredView}>
              <View style={baseStyles.modalView}>
                <Text style={baseStyles.modalText}>{instructionText}</Text>
                <TouchableOpacity
                  style={[baseStyles.button, baseStyles.buttonCancel]}
                  onPress={toggleModal}
                >
                  <Text style={baseStyles.textStyle}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View
            testID="AssignmentPlayersGrid"
            style={[
              baseStyles.assignmentPlayersGrid,
              isWideLayout && baseStyles.assignmentPlayersGridWide,
            ]}
          >
            {players.map((player) => (
              <MatchSelectionCard
                key={player.id}
                testID="AssignmentPlayerCard"
                style={[
                  baseStyles.assignmentContainer,
                  baseStyles.playerContainer,
                  isWideLayout && baseStyles.assignmentPlayerCardWide,
                ]}
                title={player.name}
                selectedCount={getAssignmentCount(player.id)}
                // This flow counts progress against the POOL, not a per-player
                // cap — the pick surfaces pass their cap here instead.
                totalCount={nonCommonMatches.length}
                collapsed={Boolean(collapsedPlayers[player.id])}
                onToggleCollapsed={() => togglePlayerCollapse(player.id)}
              >
                {renderMatches(player)}
              </MatchSelectionCard>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default AssignmentSection;
