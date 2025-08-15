import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
} from "react-native";
import { Player, Match } from "../../store/store";
import baseStyles from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import { colors } from "../../app/style/palette";

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
        if (updated[player.id] === undefined) {
          updated[player.id] = true;
        }
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
    (match) => match.id !== commonMatchId
  );

  /**
   * Renders a compact match item for the grid view.
   * Used when displaying matches in grid layout mode.
   *
   * @function
   * @param {Match} match - The match object to render.
   * @param {string} playerId - The ID of the player for whom the match is being rendered.
   * @param {number} index - The index of the match in the list (used for numbering).
   * @returns {JSX.Element} A TouchableOpacity component representing the compact match item.
   */
  const renderCompactMatchItem = (
    match: Match,
    playerId: string,
    index: number
  ) => {
    const isSelected = playerAssignments[playerId]?.includes(match.id);
    const homeTeamLogo = getTeamLogoWithFallback(match.homeTeam);
    const awayTeamLogo = getTeamLogoWithFallback(match.awayTeam);

    return (
      <TouchableOpacity
        style={[
          baseStyles.compactMatchItem,
          isSelected && baseStyles.selectedCompactMatchItem,
        ]}
        onPress={() => toggleMatchAssignment(playerId, match.id)}
      >
        <View style={baseStyles.compactMatchNumberBadge}>
          <Text style={baseStyles.compactMatchNumberText}>{index + 1}</Text>
        </View>
        <View style={baseStyles.compactTeamsContainer}>
          {homeTeamLogo ? (
            <Image
              source={homeTeamLogo}
              style={baseStyles.compactTeamLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={baseStyles.compactTeamPlaceholder}>
              <Text style={baseStyles.compactTeamPlaceholderText}>
                {match.homeTeam.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={baseStyles.compactVsText}>vs</Text>
          {awayTeamLogo ? (
            <Image
              source={awayTeamLogo}
              style={baseStyles.compactTeamLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={baseStyles.compactTeamPlaceholder}>
              <Text style={baseStyles.compactTeamPlaceholderText}>
                {match.awayTeam.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Renders the list of matches for a specific player, adapting to grid or list view.
   * Switches between grid and list layouts based on the useGridLayout state.
   *
   * @function
   * @param {Player} player - The player object.
   * @param {Match[]} matchList - The list of matches to render for the player.
   * @returns {JSX.Element} A View containing either a grid or a FlatList of matches.
   */
  const renderMatches = (player: Player, matchList: Match[]) => {
    if (useGridLayout) {
      return (
        <View style={baseStyles.gridContainer}>
          {matchList.map((match, index) => (
            <View key={match.id} style={baseStyles.gridItem}>
              {renderCompactMatchItem(match, player.id, index)}
            </View>
          ))}
        </View>
      );
    } else {
      return (
        <FlatList
          key={`list-${player.id}`}
          data={matchList}
          keyExtractor={(item) => item.id}
          numColumns={1}
          renderItem={({ item, index }) =>
            renderMatchItem(item, player.id, index)
          }
          scrollEnabled={false}
        />
      );
    }
  };

  /**
   * Renders a single match item for the list view.
   * Displays team logos, names, and selection status with a LinearGradient background.
   *
   * @function
   * @param {Match} match - The match object to render.
   * @param {string} playerId - The ID of the player for whom the match is being rendered.
   * @param {number} index - The index of the match in the list (used for numbering).
   * @returns {JSX.Element} A TouchableOpacity component representing the match item.
   */
  const renderMatchItem = (match: Match, playerId: string, index: number) => {
    const isSelected = playerAssignments[playerId]?.includes(match.id);
    const homeTeamLogo = getTeamLogoWithFallback(match.homeTeam);
    const awayTeamLogo = getTeamLogoWithFallback(match.awayTeam);

    return (
      <TouchableOpacity
        style={[
          baseStyles.matchCard,
          isSelected && baseStyles.selectedMatchCard,
          baseStyles.matchListItem,
        ]}
        onPress={() => toggleMatchAssignment(playerId, match.id)}
      >
        <View style={baseStyles.matchNumberBadge}>
          <Text style={baseStyles.matchNumberText}>{index + 1}</Text>
        </View>
        <LinearGradient
          colors={[colors.primaryLighter, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={baseStyles.matchCardGradient}
        >
          <View style={baseStyles.matchTeamsContainer}>
            <View style={baseStyles.matchTeamColumn}>
              <View style={baseStyles.logoContainer}>
                {homeTeamLogo ? (
                  <Image source={homeTeamLogo} style={baseStyles.teamLogo} />
                ) : (
                  <View style={baseStyles.teamLogoPlaceholder}>
                    <Text style={baseStyles.teamLogoPlaceholderText}>
                      {match.homeTeam.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={baseStyles.teamName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {match.homeTeam}
              </Text>
            </View>
            <View style={baseStyles.vsDividerHorizontal}>
              <Text style={baseStyles.vsText}>VS</Text>
            </View>
            <View style={baseStyles.matchTeamColumn}>
              <View style={baseStyles.logoContainer}>
                {awayTeamLogo ? (
                  <Image source={awayTeamLogo} style={baseStyles.teamLogo} />
                ) : (
                  <View style={baseStyles.teamLogoPlaceholder}>
                    <Text style={baseStyles.teamLogoPlaceholderText}>
                      {match.awayTeam.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={baseStyles.teamName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {match.awayTeam}
              </Text>
            </View>
          </View>
          <View style={baseStyles.selectionCheckmark}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isSelected ? colors.primary : colors.border}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

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
                      Math.min(matchesPerPlayer + 1, matches.length - 1)
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

          {players.map((player) => (
            <View
              key={player.id}
              style={[
                baseStyles.assignmentContainer,
                baseStyles.playerContainer,
              ]}
            >
              <TouchableOpacity
                style={baseStyles.playerHeader}
                onPress={() => togglePlayerCollapse(player.id)}
                activeOpacity={0.7}
              >
                <View style={baseStyles.playerHeaderLeft}>
                  <Ionicons
                    name={
                      collapsedPlayers[player.id]
                        ? "chevron-forward"
                        : "chevron-down"
                    }
                    size={18}
                    color={colors.primary}
                    style={baseStyles.chevronIcon}
                  />
                  <Text style={baseStyles.playerAssignmentName}>
                    {player.name}
                  </Text>
                </View>
                <View style={baseStyles.playerBadge}>
                  <Text style={baseStyles.playerBadgeText}>
                    {getAssignmentCount(player.id)}/{nonCommonMatches.length}
                  </Text>
                </View>
              </TouchableOpacity>
              {!collapsedPlayers[player.id] &&
                renderMatches(player, nonCommonMatches)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default AssignmentSection;
