import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Modal } from "react-native";
import { Player, Match } from "../../app/store";
import styles from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";

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

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const toggleRandomModal = () => {
    setIsRandomModalVisible(!isRandomModalVisible);
  };

  const instructionText =
    "Tap on matches below to select which matches each player will drink for.";

  const randomInstructionText =
    "Randomly assign matches to players. Each player will share exactly one match with every other player.";

  return (
    <View style={styles.tabContent}>
      {/* Random Assignment Section */}
      {players.length > 0 && matches.length > 0 && commonMatchId && (
        <View style={styles.assignmentSection}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.sectionTitle}>Random Assignment</Text>
            <TouchableOpacity onPress={toggleRandomModal}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#007bff"
              />
            </TouchableOpacity>
          </View>

          <Modal
            animationType="slide"
            transparent={true}
            visible={isRandomModalVisible}
            onRequestClose={toggleRandomModal}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text style={styles.modalText}>{randomInstructionText}</Text>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={toggleRandomModal}
                >
                  <Text style={styles.textStyle}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={styles.randomizeContainer}>
            <View style={styles.matchCounterContainer}>
              <Text style={styles.matchCountLabel}>Matches per player:</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() =>
                    setMatchesPerPlayer(Math.max(1, matchesPerPlayer - 1))
                  }
                >
                  <Text style={styles.counterButtonText}>-</Text>
                </TouchableOpacity>

                <Text style={styles.counterValue}>{matchesPerPlayer}</Text>

                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() =>
                    setMatchesPerPlayer(
                      Math.min(
                        matchesPerPlayer + 1,
                        matches.length - 1 // Max = total matches minus common match
                      )
                    )
                  }
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.randomizeButton}
              onPress={() => handleRandomAssignment(matchesPerPlayer)}
            >
              <Ionicons name="shuffle" size={20} color="#fff" />
              <Text style={styles.randomizeButtonText}>Randomize Matches</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manual Assignment Section */}
      {players.length > 0 && matches.length > 0 && (
        <View style={styles.assignmentSection}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.sectionTitle}>Manual Assignment</Text>
            <TouchableOpacity onPress={toggleModal}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#007bff"
              />
            </TouchableOpacity>
          </View>

          {/* Info Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={isModalVisible}
            onRequestClose={toggleModal}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text style={styles.modalText}>{instructionText}</Text>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={toggleModal}
                >
                  <Text style={styles.textStyle}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {players.map((player) => (
            <View key={player.id} style={styles.assignmentContainer}>
              <Text style={styles.playerAssignmentName}>{player.name}</Text>

              <FlatList
                data={matches.filter((match) => match.id !== commonMatchId)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSelected = playerAssignments[player.id]?.includes(
                    item.id
                  );
                  return (
                    <TouchableOpacity
                      style={[
                        styles.assignmentItem,
                        isSelected && styles.selectedAssignmentItem,
                      ]}
                      onPress={() => toggleMatchAssignment(player.id, item.id)}
                    >
                      <View style={styles.assignmentItemContent}>
                        <Text style={styles.matchText}>
                          {item.homeTeam} vs {item.awayTeam}
                        </Text>
                        {isSelected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#007bff"
                          />
                        ) : (
                          <Ionicons
                            name="ellipse-outline"
                            size={20}
                            color="#777"
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                scrollEnabled={false}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default AssignmentSection;
