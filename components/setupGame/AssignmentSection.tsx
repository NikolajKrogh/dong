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
import baseStyles, { colors } from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";

interface AssignmentSectionProps {
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: { [playerId: string]: string[] };
  toggleMatchAssignment: (playerId: string, matchId: string) => void;
  matchesPerPlayer: number;
  setMatchesPerPlayer: (count: number) => void;
  handleRandomAssignment: (numMatches: number) => void;
}

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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRandomModalVisible, setIsRandomModalVisible] = useState(false);
  // Track current layout mode
  const [useGridLayout, setUseGridLayout] = useState(false);
  // Initialize all players as collapsed by default
  const [collapsedPlayers, setCollapsedPlayers] = useState<
    Record<string, boolean>
  >(() => {
    // Create an object with all players collapsed
    const initialState: Record<string, boolean> = {};
    players.forEach((player) => {
      initialState[player.id] = true; // true = collapsed
    });
    return initialState;
  });

  // Update collapsed players when players change
  React.useEffect(() => {
    setCollapsedPlayers((prev) => {
      const updated = { ...prev };
      players.forEach((player) => {
        // Only set if not already defined
        if (updated[player.id] === undefined) {
          updated[player.id] = true; // true = collapsed
        }
      });
      return updated;
    });
  }, [players]);

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const toggleRandomModal = () => {
    setIsRandomModalVisible(!isRandomModalVisible);
  };

  const toggleLayoutMode = () => {
    setUseGridLayout(!useGridLayout);
  };

  const togglePlayerCollapse = (playerId: string) => {
    setCollapsedPlayers((prev) => ({
      ...prev,
      [playerId]: !prev[playerId],
    }));
  };

  const instructionText =
    "Tap on matches below to select which matches each player will drink for.";

  const randomInstructionText =
    "Randomly assign matches to players. Each player will share exactly one match with every other player.";

  // Get count of assigned matches for a player
  const getAssignmentCount = (playerId: string) => {
    return playerAssignments[playerId]?.length || 0;
  };

  // Get non-common matches
  const nonCommonMatches = matches.filter(
    (match) => match.id !== commonMatchId
  );

  // Render a compact match item for grid view
  const renderCompactMatchItem = (match: Match, playerId: string) => {
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
        <View style={baseStyles.compactTeamsContainer}>
          {/* Home team icon */}
          <Image
            source={homeTeamLogo}
            style={baseStyles.compactTeamLogo}
            resizeMode="contain"
          />

          {/* VS indicator */}
          <Text style={baseStyles.compactVsText}>vs</Text>

          {/* Away team icon */}
          <Image
            source={awayTeamLogo}
            style={baseStyles.compactTeamLogo}
            resizeMode="contain"
          />
        </View>

        {/* Selection indicator */}
        <View style={baseStyles.compactCheckContainer}>
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={isSelected ? colors.primary : colors.border}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Render the matches for a player
  const renderMatches = (player: Player, matchList: Match[]) => {
    if (useGridLayout) {
      // Grid layout with 3 columns
      return (
        <View style={baseStyles.gridContainer}>
          {matchList.map((match) => (
            <View key={match.id} style={baseStyles.gridItem}>
              {renderCompactMatchItem(match, player.id)}
            </View>
          ))}
        </View>
      );
    } else {
      // Standard list layout
      return (
        <FlatList
          key={`list-${player.id}`}
          data={matchList}
          keyExtractor={(item) => item.id}
          numColumns={1}
          renderItem={({ item }) => renderMatchItem(item, player.id)}
          scrollEnabled={false}
        />
      );
    }
  };

  // Render a single match item for list view
  const renderMatchItem = (match: Match, playerId: string) => {
    const isSelected = playerAssignments[playerId]?.includes(match.id);
    const homeTeamLogo = getTeamLogoWithFallback(match.homeTeam);
    const awayTeamLogo = getTeamLogoWithFallback(match.awayTeam);

    return (
      <TouchableOpacity
        style={[
          baseStyles.assignmentItem,
          isSelected && baseStyles.selectedAssignmentItem,
        ]}
        onPress={() => toggleMatchAssignment(playerId, match.id)}
      >
        <View style={baseStyles.matchTeamsSection}>
          {/* Home team row */}
          <View style={baseStyles.matchTeamRow}>
            <Image
              source={homeTeamLogo}
              style={baseStyles.matchTeamLogo}
              resizeMode="contain"
            />
            <Text
              style={baseStyles.matchTeamName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {match.homeTeam}
            </Text>
          </View>

          {/* Divider with vs text */}
          <View style={baseStyles.matchDivider}>
            <Text style={baseStyles.matchVsText}>vs</Text>
          </View>

          {/* Away team row */}
          <View style={baseStyles.matchTeamRow}>
            <Image
              source={awayTeamLogo}
              style={baseStyles.matchTeamLogo}
              resizeMode="contain"
            />
            <Text
              style={baseStyles.matchTeamName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {match.awayTeam}
            </Text>
          </View>
        </View>

        {/* Selection indicator */}
        <View style={baseStyles.matchActionsContainer}>
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={isSelected ? colors.primary : colors.border}
          />
        </View>
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
                color = {colors.primary}
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
                  <Ionicons name="remove-outline" size={20} color="#fff" />
                </TouchableOpacity>

                <Text style={baseStyles.counterValue}>{matchesPerPlayer}</Text>

                <TouchableOpacity
                  style={baseStyles.counterButton}
                  onPress={() =>
                    setMatchesPerPlayer(
                      Math.min(
                        matchesPerPlayer + 1,
                        matches.length - 1 // Max = total matches minus common match
                      )
                    )
                  }
                >
                  <Ionicons name="add-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={baseStyles.randomizeButton}
              onPress={() => handleRandomAssignment(matchesPerPlayer)}
            >
              <Ionicons name="shuffle" size={20} color="#fff" />
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
                  color="#007bff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleModal}>
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color="#007bff"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Modal */}
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
              {/* Collapsible Player Header */}
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
                    color="#007bff"
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

              {/* Render matches only if not collapsed */}
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
