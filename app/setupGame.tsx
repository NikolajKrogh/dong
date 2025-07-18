import React, { useState, useEffect } from "react";
import { Alert, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import styles from "./style/setupGameStyles";
import { colors } from "./style/palette"; 
import {
  SetupGamePlayerList,
  MatchList,
  AssignmentSection,
  SetupWizard,
  CommonMatchSelector,
} from "../components";
import { Player, Match } from "../store/store";
import { LeagueEndpoint } from "../constants/leagues";
import { useMatchData } from "../hooks/useMatchData";

interface SelectedMatchData {
  id: string;
  team1: string;
  team2: string;
  time?: string;
}

/**
 * @brief SetupGameScreen component for configuring the game.
 *
 * This component orchestrates the entire game setup process. It manages
 * state for player creation, match selection (including fetching and filtering),
 * assignment of matches to players, and selection of a common match.
 * It utilizes various child components for each step of the setup wizard
 * and leverages `useGameStore` for global state management and `useMatchData`
 * for fetching match-related information.
 */
const SetupGameScreen = () => {
  /**
   * @brief Expo Router instance for navigation.
   */
  const router = useRouter();
  /**
   * @brief State for the name of a new player being added.
   */
  const [newPlayerName, setNewPlayerName] = useState("");
  /**
   * @brief State for the selected home team name for a new match.
   */
  const [homeTeam, setHomeTeam] = useState("");
  /**
   * @brief State for the selected away team name for a new match.
   */
  const [awayTeam, setAwayTeam] = useState("");
  /**
   * @brief State for the ID of the currently selected common match.
   */
  const [selectedCommonMatch, setSelectedCommonMatch] = useState<string | null>(
    null
  );
  /**
   * @brief State for data of a match selected from a dropdown or list, used to pre-fill team names.
   */
  const [selectedMatchData, setSelectedMatchData] =
    useState<SelectedMatchData | null>(null);
  /**
   * @brief State for the list of leagues available for filtering, typically fetched from an API.
   */
  const [availableLeagues, setAvailableLeagues] = useState<LeagueEndpoint[]>(
    []
  );
  /**
   * @brief State for the date selected by the user to filter matches.
   */
  const [selectedDate, setSelectedDate] = useState("");

  /**
   * @brief Destructured state and setters from `useGameStore` for global game management.
   * @property players - Array of current players.
   * @property matches - Array of current matches.
   * @property commonMatchId - ID of the common match.
   * @property playerAssignments - Object mapping player IDs to their assigned match IDs.
   * @property matchesPerPlayer - Number of matches assigned per player.
   * @property setGlobalPlayers - Function to update the global players list.
   * @property setGlobalMatches - Function to update the global matches list.
   * @property setGlobalCommonMatchId - Function to update the global common match ID.
   * @property setGlobalPlayerAssignments - Function to update global player assignments.
   * @property setMatchesPerPlayer - Function to update the number of matches per player.
   */
  const {
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer,
    setPlayers: setGlobalPlayers,
    setMatches: setGlobalMatches,
    setCommonMatchId: setGlobalCommonMatchId,
    setPlayerAssignments: setGlobalPlayerAssignments,
    setMatchesPerPlayer,
  } = useGameStore();

  /**
   * @brief Destructured data from `useMatchData` hook.
   * @property apiLeagues - Leagues fetched from the API, aliased from `availableLeagues` in the hook.
   * @property teamsData - Team data fetched from the API.
   * @property isLoading - Boolean indicating if match data is currently loading.
   */
  const {
    availableLeagues: apiLeagues,
    teamsData,
    isLoading,
  } = useMatchData(selectedDate);

  /**
   * @brief Effect hook to update the local `availableLeagues` state when `apiLeagues` from `useMatchData` changes.
   */
  useEffect(() => {
    if (apiLeagues && apiLeagues.length > 0) {
      setAvailableLeagues(apiLeagues);
    }
  }, [apiLeagues]);

  /**
   * @brief Boolean flag indicating if the user can advance to the matches setup step.
   * True if at least one player has been added.
   */
  const canAdvanceToMatches = players.length > 0;
  /**
   * @brief Boolean flag indicating if the user can advance to the common match setup step.
   * True if at least two matches have been added.
   */
  const canAdvanceToCommonMatch = matches.length > 0;
  /**
   * @brief Boolean flag indicating if the user can advance to the assignment setup step.
   * True if at least two matches have been added and a common match has been selected.
   */
  const canAdvanceToAssign = matches.length >= 1 && commonMatchId !== null;
  /**
   * @brief Boolean flag indicating if the user can start the game.
   * True if there are players, at least one match, and a common match is selected.
   * Individual player assignments (beyond the common match) are not strictly required to enable starting the game.
   */
  const canStartGame =
    players.length > 0 && matches.length > 0 && commonMatchId !== null;

  /**
   * @brief Renders the player list setup step.
   * @return The JSX element for the player list setup.
   */
  const renderPlayersStep = () => (
    <SetupGamePlayerList
      players={players}
      newPlayerName={newPlayerName}
      setNewPlayerName={setNewPlayerName}
      handleAddPlayer={handleAddPlayer}
      handleRemovePlayer={handleRemovePlayer}
    />
  );

  /**
   * @brief Renders the matches setup step.
   * @return The JSX element for the matches setup.
   */
  const renderMatchesStep = () => (
    <MatchList
      matches={matches}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      setHomeTeam={setHomeTeam}
      setAwayTeam={setAwayTeam}
      handleAddMatch={handleAddMatch}
      handleRemoveMatch={handleRemoveMatch}
      setGlobalMatches={setGlobalMatches}
    />
  );

  /**
   * @brief Renders the common match setup step.
   * @return The JSX element for the common match setup.
   */
  const renderCommonMatchStep = () => (
    <CommonMatchSelector
      matches={matches}
      selectedCommonMatch={commonMatchId}
      handleSelectCommonMatch={handleSelectCommonMatch}
    />
  );

  /**
   * @brief Renders the assignment setup step.
   * @return The JSX element for the assignment setup.
   */
  const renderAssignStep = () => (
    <AssignmentSection
      players={players}
      matches={matches}
      commonMatchId={commonMatchId}
      playerAssignments={playerAssignments}
      toggleMatchAssignment={toggleMatchAssignment}
      matchesPerPlayer={matchesPerPlayer}
      setMatchesPerPlayer={setMatchesPerPlayer}
      handleRandomAssignment={handleRandomAssignment}
    />
  );

  /**
   * @brief Handles adding a new player to the game.
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
   * @brief Handles removing a player from the game.
   * @param playerId The ID of the player to remove.
   */
  const handleRemovePlayer = (playerId: string) => {
    setGlobalPlayers((prevPlayers) =>
      prevPlayers.filter((player) => player.id !== playerId)
    );

    setGlobalPlayerAssignments((prevAssignments) => {
      const newAssignments: { [key: string]: string[] } = {
        ...prevAssignments,
      };
      delete newAssignments[playerId];
      return newAssignments;
    });
  };

  /**
   * @brief Handles adding a new match to the game.
   */
  const handleAddMatch = () => {
    if (homeTeam.trim() && awayTeam.trim()) {
      const newMatch: Match = {
        id: String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0,
        startTime: selectedMatchData?.time || undefined,
      };
      setGlobalMatches([...matches, newMatch]);
      setHomeTeam("");
      setAwayTeam("");
      setSelectedMatchData(null);
    }
  };

  /**
   * @brief Handles removing a match from the game.
   * @param matchId The ID of the match to remove.
   */
  const handleRemoveMatch = (matchId: string) => {
    setGlobalMatches((prevMatches) =>
      prevMatches.filter((match) => match.id !== matchId)
    );

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

    if (commonMatchId === matchId) {
      setGlobalCommonMatchId(null);
      setSelectedCommonMatch(null);
    }
  };

  /**
   * @brief Handles selecting a common match for the game.
   * @param matchId The ID of the common match.
   */
  const handleSelectCommonMatch = (matchId: string) => {
    setSelectedCommonMatch(matchId);
    setGlobalCommonMatchId(matchId);
  };

  /**
   * @brief Toggles the assignment of a match to a player.
   * @param playerId The ID of the player.
   * @param matchId The ID of the match.
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
   * @brief Handles the start game action.
   *
   * Validates that there are players, matches, and a common match selected
   * before navigating to the game progress screen.
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

    const assignedMatchIds = new Set(Object.values(playerAssignments).flat());
    const filteredMatches = matches.filter(
      (match) =>
        assignedMatchIds.has(match.id) ||
        (commonMatchId && match.id === commonMatchId)
    );
    setGlobalMatches(filteredMatches);

    router.push("/gameProgress");
  };

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
    if (!commonMatchId) {
      throw new Error("Common match ID is required for assignment");
    }

    // Check if all players have exact matches
    const allHaveExactMatches = players.every(
      (player) => newAssignments[player.id].length === numMatches
    );
    if (!allHaveExactMatches) {
      throw new Error(
        `Could not assign exactly ${numMatches} matches to each player.`
      );
    }

    // Check if all players have the common match
    const allHaveCommonMatch = players.every((player) =>
      newAssignments[player.id].includes(commonMatchId)
    );
    if (!allHaveCommonMatch) {
      throw new Error("Not all players have the common match");
    }

    // Check if every pair shares exactly TWO matches (common + unique)
    for (let i = 0; i < players.length - 1; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = newAssignments[players[i].id];
        const player2 = newAssignments[players[j].id];
        const sharedMatches = player1.filter((m) => player2.includes(m));

        if (sharedMatches.length !== 2) {
          throw new Error(
            `Players ${players[i].name} and ${players[j].name} share ${sharedMatches.length} matches (expected exactly 2: the common match + one unique pair match).`
          );
        }

        // One of the shared matches must be the common match
        if (!sharedMatches.includes(commonMatchId)) {
          throw new Error(
            `Players ${players[i].name} and ${players[j].name} don't share the common match.`
          );
        }
      }
    }
  }

  /**
   * @brief Randomly assigns matches to players following specific distribution rules.
   *
   * This function creates a match distribution where:
   * 1. All players get the common match
   * 2. Each pair of players shares exactly one additional unique match
   * 3. Additional individual matches are assigned as needed to reach the target count
   *
   * The algorithm ensures that no player pair shares more than two matches total
   * (the common match plus their unique pair match).
   *
   * @param numMatches The number of ADDITIONAL matches each player should have beyond the common match.
   *                   Total matches per player will be numMatches + 1.
   *
   * @throws {Error} If no common match is selected
   * @throws {Error} If there aren't enough unique matches for all player pairs
   * @throws {Error} If the total available matches is insufficient for the distribution
   * @throws {Error} If the algorithm couldn't satisfy all constraints
   *
   * @note The calculation for minimum required matches is:
   *       1 (common) + n(n-1)/2 (pairs) + extra matches if numMatches > n
   *       where n is the number of players
   */
  const handleRandomAssignment = (numMatches: number) => {
    try {
      // Ensure we have a common match
      if (!commonMatchId) {
        throw new Error("Please select a common match first");
      }

      // Create a non-nullable version for TypeScript
      const commonId: string = commonMatchId;

      // numMatches is now ADDITIONAL matches beyond the common match
      // So total matches per player is numMatches + 1
      const totalMatchesPerPlayer = numMatches + 1;

      const numPlayers = players.length;
      const availableMatches = matches.filter((match) => match.id !== commonId);

      // Calculate how many matches we need
      // 1. Common match (1)
      // 2. One match per pair of players: n(n-1)/2 where n is number of players
      // 3. Any additional matches to reach numMatches+1 per player
      const pairCount = (numPlayers * (numPlayers - 1)) / 2;

      // Each player will have: 1 (common) + (n-1) (one per pair with other players)
      // So if totalMatchesPerPlayer > n, we need extra matches
      const matchesFromPairs = 1 + (numPlayers - 1); // common + n-1 shared pair matches
      const extraMatchesPerPlayer = Math.max(
        0,
        totalMatchesPerPlayer - matchesFromPairs
      );
      const extraMatchesTotal = extraMatchesPerPlayer * numPlayers;

      const totalMatchesNeeded = 1 + pairCount + extraMatchesTotal;

      if (matches.length < totalMatchesNeeded) {
        throw new Error(
          `Need at least ${totalMatchesNeeded} matches total (1 common, ${pairCount} for pairs, and ${extraMatchesTotal} extra) for ${numPlayers} players with ${numMatches} additional matches each`
        );
      }

      // Create fresh assignments with common match for everyone
      const newAssignments: { [playerId: string]: string[] } = {};
      players.forEach((player) => {
        newAssignments[player.id] = [commonId];
      });

      // Create all player pairs and keep track of which pairs share which matches
      const playerPairs: [string, string][] = [];
      const pairSharedMatches: { [pairKey: string]: string[] } = {};

      for (let i = 0; i < players.length - 1; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const pair: [string, string] = [players[i].id, players[j].id];
          const pairKey = pair.sort().join("-");
          playerPairs.push(pair);
          pairSharedMatches[pairKey] = [commonId]; // They all share common match
        }
      }

      // Shuffle pairs and matches for randomness
      const shuffledPairs = [...playerPairs].sort(() => Math.random() - 0.5);
      const shuffledMatches = [...availableMatches].sort(
        () => Math.random() - 0.5
      );

      // Step 1: Assign one distinct match to each pair of players
      const usedMatchIndices = new Set<number>();

      for (let i = 0; i < shuffledPairs.length; i++) {
        const pair = shuffledPairs[i];

        // Find first unused match
        let matchIndex = 0;
        while (
          usedMatchIndices.has(matchIndex) &&
          matchIndex < shuffledMatches.length
        ) {
          matchIndex++;
        }

        if (matchIndex >= shuffledMatches.length) {
          throw new Error("Not enough unique matches for all player pairs");
        }

        const match = shuffledMatches[matchIndex];
        const pairKey = pair.sort().join("-");

        // Assign match to both players in pair
        newAssignments[pair[0]].push(match.id);
        newAssignments[pair[1]].push(match.id);

        // Track that this pair shares this match
        pairSharedMatches[pairKey].push(match.id);

        // Mark match as used
        usedMatchIndices.add(matchIndex);
      }

      // Step 2: If needed, assign additional matches to players who need more
      if (totalMatchesPerPlayer > 2) {
        // If players need more than common + pair matches
        const remainingMatches = shuffledMatches.filter(
          (_, index) => !usedMatchIndices.has(index)
        );

        // For each player, figure out how many more matches they need
        for (const player of players) {
          const currentCount = newAssignments[player.id].length;
          const neededCount = totalMatchesPerPlayer - currentCount;

          if (neededCount <= 0) continue; // This player has enough

          // Take the first neededCount matches that haven't been used yet
          // and that don't create pair conflicts
          let assignedThisRound = 0;

          for (const match of remainingMatches) {
            if (assignedThisRound >= neededCount) break;

            // Skip if player already has this match
            if (newAssignments[player.id].includes(match.id)) continue;

            // Need to check if adding this would create a conflict
            let createsPairConflict = false;

            for (const otherPlayer of players) {
              if (otherPlayer.id === player.id) continue;

              if (newAssignments[otherPlayer.id].includes(match.id)) {
                // They would share this match - check if they already share matches
                const pairKey = [player.id, otherPlayer.id].sort().join("-");
                if (pairSharedMatches[pairKey].length >= 2) {
                  // Already share common + unique
                  createsPairConflict = true;
                  break;
                }

                // If we assign this match, update the shared matches for this pair
                pairSharedMatches[pairKey].push(match.id);
              }
            }

            if (!createsPairConflict) {
              newAssignments[player.id].push(match.id);
              assignedThisRound++;
            }
          }

          if (newAssignments[player.id].length < totalMatchesPerPlayer) {
            throw new Error(
              `Could only assign ${
                newAssignments[player.id].length
              }/${totalMatchesPerPlayer} matches to ${
                player.name
              }. Need more matches.`
            );
          }
        }
      }

      // Update our verification function call to use totalMatchesPerPlayer
      verifyFinalAssignments(players, newAssignments, totalMatchesPerPlayer);

      // Success!
      setGlobalPlayerAssignments(newAssignments);
      Alert.alert(
        "Success",
        `Matches assigned! Each player has ${numMatches} additional matches plus the common match, sharing exactly one additional match with each other player.`
      );
    } catch (error: any) {
      Alert.alert("Failed", error.message || "Unknown error.");
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Tab Navigation */}
      <SetupWizard
        renderPlayersStep={renderPlayersStep}
        renderMatchesStep={renderMatchesStep}
        renderCommonMatchStep={renderCommonMatchStep} // New step
        renderAssignStep={renderAssignStep}
        handleStartGame={handleStartGame}
        canAdvanceToMatches={canAdvanceToMatches}
        canAdvanceToCommonMatch={canAdvanceToCommonMatch}
        canAdvanceToAssign={canAdvanceToAssign}
        canStartGame={canStartGame}
      />
    </SafeAreaView>
  );
};

export default SetupGameScreen;
