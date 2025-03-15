import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "./store";
import { Ionicons } from "@expo/vector-icons";
import styles from "./style/setupGameStyles";

interface Player {
  id: string;
  name: string;
}

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  goals: number;
}

const SetupGameScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("players"); // Add this line
  const [newPlayerName, setNewPlayerName] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [selectedCommonMatch, setSelectedCommonMatch] = useState<string | null>(
    null
  );

  const {
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer, // Get from store instead of local state
    setPlayers: setGlobalPlayers,
    setMatches: setGlobalMatches,
    setCommonMatchId: setGlobalCommonMatchId,
    setPlayerAssignments: setGlobalPlayerAssignments,
    setMatchesPerPlayer, // Get the action from store
  } = useGameStore();

  /**
   * Handles adding a new player to the game.
   * If the input is not empty, it creates a new player object and adds it to the global state.
   */
  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      const newPlayer: Player = {
        id: String(Date.now()),
        name: newPlayerName.trim(),
      };
      setGlobalPlayers([...players, newPlayer]);
      setNewPlayerName("");

      setGlobalPlayerAssignments({
        ...playerAssignments,
        [newPlayer.id]: [],
      });
    }
  };

  /**
   * Handles removing a player from the game.
   * @param playerId - The ID of the player to remove.
   */
  const handleRemovePlayer = (playerId: string) => {
    // Remove the player from the players array
    setGlobalPlayers((prevPlayers) =>
      prevPlayers.filter((player) => player.id !== playerId)
    );

    // Remove the player's assignments
    setGlobalPlayerAssignments((prevAssignments) => {
      const newAssignments: { [key: string]: string[] } = {
        ...prevAssignments,
      };
      delete newAssignments[playerId];
      return newAssignments;
    });
  };

  /**
   * Handles adding a new match to the game.
   * If both home team and away team inputs are not empty, it creates a new match object and adds it to the global state.
   */
  const handleAddMatch = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        goals: 0,
      };
      setGlobalMatches([...matches, newMatch]);
      setHomeTeam("");
      setAwayTeam("");
    }
  };

  /**
   * Handles removing a match from the game.
   * @param matchId - The ID of the match to remove.
   */
  const handleRemoveMatch = (matchId: string) => {
    setGlobalMatches((prevMatches) =>
      prevMatches.filter((match) => match.id !== matchId)
    );

    // Also remove this match from any player assignments
    setGlobalPlayerAssignments((prevAssignments) => {
      const newAssignments: { [key: string]: string[] } = {};
      for (const playerId in prevAssignments) {
        if (prevAssignments.hasOwnProperty(playerId)) {
          newAssignments[playerId] = prevAssignments[playerId].filter(
            (id) => id !== matchId
          );
        }
      }
      return newAssignments;
    });

    // If the removed match was the common match, reset commonMatchId
    if (commonMatchId === matchId) {
      setGlobalCommonMatchId(null);
      setSelectedCommonMatch(null);
    }
  };

  /**
   * Handles selecting a common match for all players to drink for.
   * @param matchId - The ID of the match selected as the common match.
   */
  const handleSelectCommonMatch = (matchId: string) => {
    setSelectedCommonMatch(matchId);
    setGlobalCommonMatchId(matchId);
  };

  /**
   * Toggles the assignment of a match to a player.
   * If the match is already assigned to the player, it removes the assignment. Otherwise, it adds the assignment.
   * @param playerId - The ID of the player to toggle the match assignment for.
   */
  const toggleMatchAssignment = (playerId: string, matchId: string) => {
    setGlobalPlayerAssignments(
      (prevAssignments: { [playerId: string]: string[] }) => {
        const currentAssignments = prevAssignments[playerId] || [];
        const index = currentAssignments.indexOf(matchId);

        let newAssignments: string[];
        if (index === -1) {
          newAssignments = [...currentAssignments, matchId];
        } else {
          newAssignments = [...currentAssignments];
          newAssignments.splice(index, 1);
        }

        return {
          ...prevAssignments,
          [playerId]: newAssignments,
        };
      }
    );
  };

  /**
   * Handles starting the game.
   * It validates that there are players, matches, and a common match selected before navigating to the game progress screen.
   */
  const handleStartGame = () => {
    if (players.length === 0) {
      Alert.alert(
        "No Players",
        "Please add at least one player to start the game."
      );
      return;
    }

    if (matches.length === 0) {
      Alert.alert(
        "No Matches",
        "Please add at least one match to start the game."
      );
      return;
    }

    if (!commonMatchId) {
      Alert.alert(
        "No Common Match",
        "Please select a common match that all players will drink for."
      );
      return;
    }

    router.push("/gameProgress");
  };

  /**
   * Verifies that there are enough matches and valid parameters
   * to assign each player the desired number of matches.
   * @param numPlayers The total number of players.
   * @param availableMatches The matches that can be assigned (excluding the common match).
   * @param numMatches The desired number of matches per player.
   * @throws Error if conditions cannot be met.
   */
  function verifyAssignmentConstraints(
    numPlayers: number,
    availableMatches: Match[],
    numMatches: number
  ): void {
    const requiredPairs = (numPlayers * (numPlayers - 1)) / 2;
    if (availableMatches.length < requiredPairs) {
      throw new Error(
        `For ${numPlayers} players to each share exactly one match, you need at least ${requiredPairs} matches (excluding the common match).`
      );
    }

    if (numMatches < numPlayers - 1) {
      throw new Error(
        `For ${numPlayers} players to share matches, each player needs at least ${
          numPlayers - 1
        } matches.`
      );
    }

    const totalMatchesNeeded = Math.ceil((numPlayers * numMatches) / 2);
    if (availableMatches.length < totalMatchesNeeded) {
      throw new Error(
        `You requested ${numMatches} matches per player, requiring at least ${totalMatchesNeeded} matches, but there are only ${availableMatches.length} available.`
      );
    }
  }

  /**
   * Creates and returns a new assignments object.
   * @param players The array of players.
   * @returns An object mapping each player ID to an empty array of match IDs.
   */
  function createEmptyAssignments(players: Player[]): {
    [playerId: string]: string[];
  } {
    const newAssignments: { [playerId: string]: string[] } = {};
    players.forEach((player) => {
      newAssignments[player.id] = [];
    });
    return newAssignments;
  }

  /**
   * Ensures each pair of players shares exactly one match by assigning one match to both.
   * @param players The array of players.
   * @param shuffledMatches The randomized pool of available matches.
   * @param newAssignments The mutable assignments object.
   * @param usedMatchIndices A set to track which matches have been used already.
   * @param playerPairShares An object to mark which pairs already share a match.
   * @throws Error if it cannot assign a match for each player pair.
   */
  function assignOneSharedMatchPerPair(
    players: Player[],
    shuffledMatches: Match[],
    newAssignments: { [playerId: string]: string[] },
    usedMatchIndices: Set<number>,
    playerPairShares: { [key: string]: boolean }
  ): void {
    for (let i = 0; i < players.length - 1; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];
        const pairKey = `${player1.id}-${player2.id}`;

        let matchAssigned = false;
        for (let k = 0; k < shuffledMatches.length; k++) {
          if (!usedMatchIndices.has(k)) {
            const match = shuffledMatches[k];
            newAssignments[player1.id].push(match.id);
            newAssignments[player2.id].push(match.id);
            playerPairShares[pairKey] = true;
            usedMatchIndices.add(k);
            matchAssigned = true;
            break;
          }
        }

        if (!matchAssigned) {
          throw new Error(
            `Ran out of matches while ensuring player pairs share exactly one match.`
          );
        }
      }
    }
  }

  /**
   * Fills remaining assignment slots so each player reaches numMatches matches.
   * @param players The array of players.
   * @param shuffledMatches The randomized pool of available matches.
   * @param newAssignments The mutable assignments object.
   * @param usedMatchIndices A set to track which matches have been used.
   * @param playerPairShares An object marking which pairs already have a shared match.
   * @param numMatches The desired number of matches per player.
   * @throws Error if it fails to assign the correct number of matches to every player.
   */
  function fillRemainingSlots(
    players: Player[],
    shuffledMatches: Match[],
    newAssignments: { [playerId: string]: string[] },
    usedMatchIndices: Set<number>,
    playerPairShares: { [key: string]: boolean },
    numMatches: number
  ): void {
    // Calculate how many more matches each player needs
    const additionalMatchesNeeded: { [playerId: string]: number } = {};
    players.forEach((player) => {
      const current = newAssignments[player.id].length;
      additionalMatchesNeeded[player.id] = Math.max(0, numMatches - current);
    });

    // Sort players by number of additional matches needed, descending
    const playersSortedByNeed = [...players].sort((a, b) => {
      return additionalMatchesNeeded[b.id] - additionalMatchesNeeded[a.id];
    });

    // Assign remaining matches individually
    for (const player of playersSortedByNeed) {
      while (newAssignments[player.id].length < numMatches) {
        let matchAssigned = false;
        for (let k = 0; k < shuffledMatches.length; k++) {
          if (!usedMatchIndices.has(k)) {
            const match = shuffledMatches[k];
            // Skip if already assigned to this player
            if (newAssignments[player.id].includes(match.id)) continue;

            // Check if assigning this match creates more than one shared match
            // (We only want exactly one shared match per pair.)
            const hasConflict = players.some((other) => {
              if (other.id === player.id) return false;
              const pairKey = [player.id, other.id].sort().join("-");
              return (
                playerPairShares[pairKey] &&
                newAssignments[other.id].includes(match.id)
              );
            });

            if (!hasConflict) {
              newAssignments[player.id].push(match.id);
              usedMatchIndices.add(k);
              matchAssigned = true;
              break;
            }
          }
        }
        if (!matchAssigned) {
          throw new Error(
            `Could not assign enough matches to ${player.name} while maintaining constraints.`
          );
        }
      }
    }
  }

  /**
   * Verifies the final assignments meet both the desired count and the one-match-per-pair requirement.
   * @param players The array of players.
   * @param newAssignments The assignments object.
   * @param numMatches The desired number of matches per player.
   * @throws Error if constraints are not met.
   */
  function verifyFinalAssignments(
    players: Player[],
    newAssignments: { [playerId: string]: string[] },
    numMatches: number
  ): void {
    // Check if all players have exact matches
    const allHaveExactMatches = players.every(
      (player) => newAssignments[player.id].length === numMatches
    );
    if (!allHaveExactMatches) {
      throw new Error(
        `Could not assign exactly ${numMatches} matches to each player.`
      );
    }

    // Check if every pair has exactly one match in common
    for (let i = 0; i < players.length - 1; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = newAssignments[players[i].id];
        const player2 = newAssignments[players[j].id];
        const sharedCount = player1.filter((m) => player2.includes(m)).length;

        if (sharedCount !== 1) {
          throw new Error(
            `Players ${players[i].name} and ${players[j].name} do not share exactly one match (found: ${sharedCount}).`
          );
        }
      }
    }
  }

  /**
   * Handles random assignment of matches to players ensuring:
   * 1. Each player gets exactly numMatches matches
   * 2. Every player pair shares exactly one match
   * @param numMatches The desired number of matches per player.
   */
  const handleRandomAssignment = (numMatches: number) => {
    try {
      const numPlayers = players.length;
      const availableMatches = matches.filter(
        (match) => match.id !== commonMatchId
      );

      // Check all constraints up front
      verifyAssignmentConstraints(numPlayers, availableMatches, numMatches);

      // Create and shuffle assignments
      const newAssignments = createEmptyAssignments(players);
      const shuffledMatches = [...availableMatches].sort(
        () => Math.random() - 0.5
      );

      // Track pair-sharing and used matches
      const playerPairShares: { [key: string]: boolean } = {};
      const usedMatchIndices: Set<number> = new Set();

      // Phase 1: Exact one-match sharing for each pair
      assignOneSharedMatchPerPair(
        players,
        shuffledMatches,
        newAssignments,
        usedMatchIndices,
        playerPairShares
      );

      // Phase 2: Fill remaining slots
      fillRemainingSlots(
        players,
        shuffledMatches,
        newAssignments,
        usedMatchIndices,
        playerPairShares,
        numMatches
      );

      // Verify results
      verifyFinalAssignments(players, newAssignments, numMatches);

      // If all constraints satisfied, update global state
      setGlobalPlayerAssignments(newAssignments);
      Alert.alert(
        "Success",
        `Matches assigned! Each player has exactly ${numMatches} matches, sharing exactly one match with every other player.`
      );
    } catch (error: any) {
      // If any step fails, show an error message
      Alert.alert("Failed", error.message || "Unknown error.", [
        { text: "OK" },
      ]);
    }
  };

  // Render players tab content
  const renderPlayersTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Players</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add new player"
          value={newPlayerName}
          onChangeText={setNewPlayerName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              ...styles.playerItem,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.playerName}>{item.name}</Text>
            <TouchableOpacity
              style={removeButtonStyle.button}
              onPress={() => handleRemovePlayer(item.id)}
            >
              <Text style={removeButtonStyle.text}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyListText}>No players added yet</Text>
        }
        scrollEnabled={false}
      />
    </View>
  );

  // Render matches tab content
  const renderMatchesTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Matches</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, styles.teamInput]}
          placeholder="Home Team"
          value={homeTeam}
          onChangeText={setHomeTeam}
        />
        <Text style={styles.vsText}>vs</Text>
        <TextInput
          style={[styles.input, styles.teamInput]}
          placeholder="Away Team"
          value={awayTeam}
          onChangeText={setAwayTeam}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddMatch}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subsectionTitle}>
        Select Match To Watch (everyone drinks)
      </Text>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 8,
              marginVertical: 4,
              borderRadius: 4,
              backgroundColor:
                selectedCommonMatch === item.id ? "#e0f7fa" : "transparent",
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => handleSelectCommonMatch(item.id)}
            >
              <Text style={styles.matchText}>
                {item.homeTeam} vs {item.awayTeam}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={removeButtonStyle.button}
              onPress={() => handleRemoveMatch(item.id)}
            >
              <Text style={removeButtonStyle.text}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyListText}>No matches added yet</Text>
        }
        scrollEnabled={false}
      />
    </View>
  );

  // Render assign tab content (both random and manual assignment)
  const renderAssignTab = () => (
    <View style={styles.tabContent}>
      {/* Random Assignment Section */}
      {players.length > 0 && matches.length > 0 && commonMatchId && (
        <View style={styles.assignmentSection}>
          <Text style={styles.sectionTitle}>Random Assignment</Text>
          <Text style={styles.instructionText}>
            Randomly assign matches to players. Each player will share exactly
            one match with every other player.
          </Text>

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
          <Text style={styles.sectionTitle}>Manual Assignment</Text>
          <Text style={styles.instructionText}>
            Select which matches each player will drink for (in addition to the
            common match)
          </Text>

          {players.map((player) => (
            <View key={player.id} style={styles.assignmentContainer}>
              <Text style={styles.playerAssignmentName}>{player.name}</Text>

              <FlatList
                data={matches.filter(
                  (match) => match.id !== selectedCommonMatch
                )}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.assignmentItem,
                      playerAssignments[player.id]?.includes(item.id) &&
                        styles.selectedAssignmentItem,
                    ]}
                    onPress={() => toggleMatchAssignment(player.id, item.id)}
                  >
                    <Text style={styles.matchText}>
                      {item.homeTeam} vs {item.awayTeam}
                    </Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Styles for the remove button (keep this)
  const removeButtonStyle = StyleSheet.create({
    button: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#ff5252",
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
    },
    text: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: Platform.OS === "ios" ? 2 : 0,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "players" && styles.activeTab]}
          onPress={() => setActiveTab("players")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "players" && styles.activeTabText,
            ]}
          >
            Players
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "matches" && styles.activeTab]}
          onPress={() => setActiveTab("matches")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "matches" && styles.activeTabText,
            ]}
          >
            Matches
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "assign" && styles.activeTab]}
          onPress={() => setActiveTab("assign")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "assign" && styles.activeTabText,
            ]}
          >
            Assign
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on selected tab */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <ScrollView>
          {activeTab === "players" && renderPlayersTab()}
          {activeTab === "matches" && renderMatchesTab()}
          {activeTab === "assign" && renderAssignTab()}

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartGame}
          >
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SetupGameScreen;
