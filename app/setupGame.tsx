import React, { useState, useEffect } from "react";
import { SafeAreaView } from "react-native";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import createSetupGameStyles from "./style/setupGameStyles";
import { useColors } from "./style/theme";
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
import {
  subscribeToRoom,
  syncMatchesToRoom,
  syncCommonMatchToRoom,
  syncAssignmentsToRoom,
  syncCurrentStepToRoom,
  syncGameStartedToRoom,
  leaveRoom,
} from "../utils/roomManager";

interface SelectedMatchData {
  id: string;
  team1: string;
  team2: string;
  time?: string;
}

/**
 * Game setup wizard: players, matches, common match selection, and assignments.
 * @component
 * @description Orchestrates multi-step setup (players > matches > common match > assignments)
 * leveraging store state + remote match data; finalizes by filtering matches and navigating to gameplay.
 */
const SetupGameScreen = () => {
  const { currentRoom, currentPlayerId } = useGameStore();
  const router = useRouter();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  /** New player name input state. */
  const [newPlayerName, setNewPlayerName] = useState("");
  /** Pending new match home team input. */
  const [homeTeam, setHomeTeam] = useState("");
  /** Pending new match away team input. */
  const [awayTeam, setAwayTeam] = useState("");
  /** ID of selected common match (local step state). */
  const [selectedCommonMatch, setSelectedCommonMatch] = useState<string | null>(
    null
  );
  /** Selected match metadata to pre-fill team inputs. */
  const [selectedMatchData, setSelectedMatchData] =
    useState<SelectedMatchData | null>(null);
  /** Leagues available for filtering (fetched). */
  const [availableLeagues, setAvailableLeagues] = useState<LeagueEndpoint[]>(
    []
  );
  /** Selected date (YYYY-MM-DD) for match filtering. */
  const [selectedDate, setSelectedDate] = useState("");
  /** Current wizard step (0-3). */
  const [currentStep, setCurrentStepInternal] = useState(0);

  // Wrapper to log step changes
  const setCurrentStep = (step: number) => {
    setCurrentStepInternal(step);
  };

  /**
   * Global game setup state and mutators sourced from the central store.
   *
   * Destructured properties:
   * @property {Player[]} players Current list of players added in the wizard.
   * @property {Match[]} matches Current list of matches (pre-start this is the full candidate set; filtered when starting the game).
   * @property {string|null} commonMatchId ID of the shared match all players drink to (null until chosen).
   * @property {Record<string,string[]>} playerAssignments Mapping of playerId -> array of individually assigned match IDs (excludes the common match which is implicit for everyone).
   * @property {number} matchesPerPlayer Target number of additional (non-common) matches per player used in distribution logic.
   * @property {(players: Player[]) => void} setPlayers (Renamed to setGlobalPlayers) Replaces the players collection.
   * @property {(matches: Match[]) => void} setMatches (Renamed to setGlobalMatches) Replaces the matches collection.
   * @property {(id: string|null) => void} setCommonMatchId (Renamed to setGlobalCommonMatchId) Sets/clears the common match.
   * @property {(assignments: Record<string,string[]>) => void} setPlayerAssignments (Renamed to setGlobalPlayerAssignments) Replaces player->match assignment map.
   * @property {(n: number) => void} setMatchesPerPlayer Adjusts target additional matches per player.
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
   * Remote match + league data for the currently selected date.
   *
   * Destructured properties:
   * @property {LeagueEndpoint[]} availableLeagues (aliased as apiLeagues) Leagues fetched for filtering & match suggestions.
   * @property {*} teamsData Reference team data (names / metadata) returned by the hook for auto-complete or validation.
   * @property {boolean} isLoading True while remote league / team data is being fetched.
   */
  const {
    availableLeagues: apiLeagues,
    teamsData,
    isLoading,
  } = useMatchData(selectedDate);

  /** Check if current user is the host */
  const isHost = currentRoom?.hostId === currentPlayerId;

  /** Sync available leagues with API results. */
  useEffect(() => {
    if (apiLeagues && apiLeagues.length > 0) {
      setAvailableLeagues(apiLeagues);
    }
  }, [apiLeagues]);

  /** Automatically add host as a player when room is created */
  useEffect(() => {
    if (
      currentRoom &&
      currentRoom.hostName &&
      players.length === 0 &&
      currentRoom.hostId
    ) {
      const hostPlayer: Player = {
        id: currentRoom.hostId,
        name: currentRoom.hostName,
      };
      setGlobalPlayers([hostPlayer]);
      setGlobalPlayerAssignments({
        [hostPlayer.id]: [],
      });
    }
  }, [currentRoom]);

  /** Track if we're currently syncing from Gun to prevent loops (use ref to avoid re-renders) */
  const isSyncingFromGunRef = React.useRef(false);

  /** Track subscribed room to prevent duplicate subscriptions */
  const subscribedRoomRef = React.useRef<string | null>(null);

  /** Track if user is host (use ref so subscription callback always has current value) */
  const isHostRef = React.useRef(isHost);

  /** Track if we've already navigated to gameProgress to prevent infinite loops */
  const hasNavigatedToGameRef = React.useRef(false);

  // Update ref whenever isHost changes
  React.useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  /** Initialize guest step from room on first load */
  useEffect(() => {
    if (
      !isHost &&
      currentRoom?.currentStep !== undefined &&
      currentRoom?.currentStep !== null
    ) {
      setCurrentStep(currentRoom.currentStep);
    }
  }, [isHost, currentRoom?.currentStep]);

  /** Subscribe to room updates and sync players + game state in real-time */
  useEffect(() => {
    if (!currentRoom?.code) return;

    // Prevent duplicate subscriptions to the same room
    if (subscribedRoomRef.current === currentRoom.code) {
      return;
    }

    subscribedRoomRef.current = currentRoom.code;

    const unsubscribe = subscribeToRoom(currentRoom.code, (updatedRoom) => {
      if (!updatedRoom) return;

      // Set flag to prevent sync loops
      isSyncingFromGunRef.current = true;

      // Update the room in the store
      useGameStore.getState().setCurrentRoom(updatedRoom);

      // Get current players
      const currentPlayers = useGameStore.getState().players;

      // Convert room players to game players
      const roomPlayers = updatedRoom.players.map((rp) => ({
        id: rp.id,
        name: rp.name,
        drinksTaken: 0,
      }));

      // Sync all players from room to ensure consistency
      // This handles both: initial sync when joining AND new players joining later
      const playerIdsInRoom = new Set(roomPlayers.map((p) => p.id));
      const playerIdsInGame = new Set(currentPlayers.map((p) => p.id));

      // Find new players (in room but not in game)
      const newPlayers = roomPlayers.filter(
        (rp) => !playerIdsInGame.has(rp.id)
      );

      // Find removed players (in game but not in room)
      const removedPlayers = currentPlayers.filter(
        (cp) => !playerIdsInRoom.has(cp.id)
      );

      // If there are changes, update the player list
      if (newPlayers.length > 0 || removedPlayers.length > 0) {

        // Build the new player list: keep existing players that are still in room + add new ones
        const updatedPlayers = [
          ...currentPlayers.filter((cp) => playerIdsInRoom.has(cp.id)),
          ...newPlayers,
        ];

        setGlobalPlayers(updatedPlayers);

        // Initialize assignments for new players
        const currentAssignments = useGameStore.getState().playerAssignments;
        const newAssignments = { ...currentAssignments };

        newPlayers.forEach((player) => {
          if (!newAssignments[player.id]) {
            newAssignments[player.id] = [];
          }
        });

        // Remove assignments for removed players
        removedPlayers.forEach((player) => {
          delete newAssignments[player.id];
        });

        setGlobalPlayerAssignments(newAssignments);

        // Show toast notification for new players only
        if (newPlayers.length > 0) {
          Toast.show({
            type: "success",
            text1: "Player Joined!",
            text2: newPlayers.map((p) => p.name).join(", "),
            position: "top",
          });
        }
      }

      // Sync game state (matches, common match, assignments)
      if (updatedRoom.matches) {
        try {
          const syncedMatches = JSON.parse(updatedRoom.matches);
          const currentMatches = useGameStore.getState().matches;

          // Only update if different (avoid loops)
          if (JSON.stringify(currentMatches) !== updatedRoom.matches) {
            setGlobalMatches(syncedMatches);
          }
        } catch (e) {
          console.error("Failed to parse matches:", e);
        }
      }

      if (updatedRoom.commonMatchId !== undefined) {
        const currentCommonId = useGameStore.getState().commonMatchId;
        if (currentCommonId !== updatedRoom.commonMatchId) {
          setGlobalCommonMatchId(updatedRoom.commonMatchId);
          setSelectedCommonMatch(updatedRoom.commonMatchId);
        }
      }

      if (updatedRoom.playerAssignments) {
        try {
          const syncedAssignments = JSON.parse(updatedRoom.playerAssignments);
          const currentAssignments = useGameStore.getState().playerAssignments;

          // Only update if different (avoid loops)
          if (
            JSON.stringify(currentAssignments) !== updatedRoom.playerAssignments
          ) {
            setGlobalPlayerAssignments(syncedAssignments);
          }
        } catch (e) {
          console.error("Failed to parse assignments:", e);
        }
      }

      // Sync current step (guests follow host)
      if (updatedRoom.currentStep != null && !isHostRef.current) {
        if (currentStep !== updatedRoom.currentStep) {
          setCurrentStep(updatedRoom.currentStep);
        }
      }

      // Check if game has started - navigate all players to gameProgress (only once)
      if (
        updatedRoom.gameStarted &&
        !isHostRef.current &&
        !hasNavigatedToGameRef.current
      ) {
        hasNavigatedToGameRef.current = true; // Prevent repeated navigation

        // Guest: Don't filter matches - they should already be synced from host
        // The host has already filtered and synced the correct matches to the room
        router.push("/gameProgress");
      }

      // Clear flag after sync is complete
      setTimeout(() => {
        isSyncingFromGunRef.current = false;
      }, 100);
    });

    return () => {
      subscribedRoomRef.current = null;
      hasNavigatedToGameRef.current = false; // Reset navigation flag for next time
      unsubscribe();
    };
  }, [currentRoom?.code]);

  /** Sync matches to room when they change (but not when syncing FROM room) */
  useEffect(() => {
    if (
      !currentRoom?.code ||
      matches.length === 0 ||
      isSyncingFromGunRef.current
    )
      return;

    syncMatchesToRoom(currentRoom.code, matches);
  }, [matches, currentRoom?.code]);

  /** Sync common match to room when it changes (but not when syncing FROM room) */
  useEffect(() => {
    if (!currentRoom?.code || isSyncingFromGunRef.current) return;

    syncCommonMatchToRoom(currentRoom.code, commonMatchId);
  }, [commonMatchId, currentRoom?.code]);

  /** Sync assignments to room when they change (but not when syncing FROM room) */
  useEffect(() => {
    if (!currentRoom?.code || isSyncingFromGunRef.current) return;

    syncAssignmentsToRoom(currentRoom.code, playerAssignments);
  }, [playerAssignments, currentRoom?.code]);

  /** Sync current step to room when host changes it (but not when syncing FROM room) */
  useEffect(() => {
    if (!currentRoom?.code || !isHost || isSyncingFromGunRef.current) {
      return;
    }
    syncCurrentStepToRoom(currentRoom.code, currentStep);
  }, [currentStep, currentRoom?.code, isHost]);

  /** Whether player step can advance (>=1 player). */
  const canAdvanceToMatches = players.length > 0;
  /** Whether match step can advance (>=1 match). */
  const canAdvanceToCommonMatch = matches.length > 0;
  /** Whether common match step can advance (>=1 match & common selected). */
  const canAdvanceToAssign = matches.length >= 1 && commonMatchId !== null;
  /** Whether Start Game is enabled (players + matches + common match). */
  const canStartGame =
    players.length > 0 && matches.length > 0 && commonMatchId !== null;

  /** Render player list step. */
  const renderPlayersStep = () => (
    <SetupGamePlayerList
      players={players}
      newPlayerName={newPlayerName}
      setNewPlayerName={setNewPlayerName}
      handleAddPlayer={handleAddPlayer}
      handleAddPlayerByName={handleAddPlayerByName}
      handleRemovePlayer={handleRemovePlayer}
      roomCode={currentRoom?.code}
      handleLeaveRoom={currentRoom ? handleLeaveRoom : undefined}
    />
  );

  /** Render matches step. */
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
      isHost={isHost}
    />
  );

  /** Render common match selection step. */
  const renderCommonMatchStep = () => (
    <CommonMatchSelector
      matches={matches}
      selectedCommonMatch={commonMatchId}
      handleSelectCommonMatch={handleSelectCommonMatch}
      isHost={isHost}
    />
  );

  /** Render assignment step. */
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
      currentPlayerId={currentPlayerId || undefined}
      isHost={isHost}
    />
  );

  /** Add new player based on current input value. */
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

  /** Add player directly by provided name (dropdown selection). */
  const handleAddPlayerByName = (playerName: string) => {
    if (playerName.trim()) {
      const newPlayer: Player = {
        id: String(Date.now()),
        name: playerName.trim(),
      };
      setGlobalPlayers([...players, newPlayer]);

      setGlobalPlayerAssignments({
        ...playerAssignments,
        [newPlayer.id]: [],
      });
    }
  };

  /** Remove player and associated assignments. */
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

  /** Add new match from home/away inputs + optional time. */
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

  /** Remove match and clean assignments; reset common match if removed. */
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

  /** Select common match and sync to store. */
  const handleSelectCommonMatch = (matchId: string) => {
    setSelectedCommonMatch(matchId);
    setGlobalCommonMatchId(matchId);
  };

  /**
   * Toggle assignment of a match to a player (adds if absent, removes if present).
   * @param {string} playerId Player identifier.
   * @param {string} matchId Match identifier.
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
   * Handle leaving the current room
   */
  const handleLeaveRoom = () => {
    if (!currentRoom?.code || !currentPlayerId) return;

    // Leave the room in Gun.js
    leaveRoom(currentRoom.code, currentPlayerId);

    // Clear local state
    useGameStore.getState().setCurrentRoom(null);
    useGameStore.getState().setCurrentPlayerId(null);

    // Reset navigation flag
    hasNavigatedToGameRef.current = false;

    // Show toast
    Toast.show({
      type: "info",
      text1: "Left Room",
      text2: `You have left room ${currentRoom.code}`,
      position: "bottom",
    });

    // Navigate back to home
    router.push("/");
  };

  /**
   * Start game after validating players, matches, and selected common match.
   */
  const handleStartGame = () => {
    if (players.length === 0) {
      Toast.show({
        type: "themedWarning",
        text1: "No Players",
        text2: "Please add at least one player to start the game.",
        position: "bottom",
      });
      return;
    }

    if (matches.length === 0) {
      Toast.show({
        type: "themedWarning",
        text1: "No Matches",
        text2: "Please add at least one match to start the game.",
        position: "bottom",
      });
      return;
    }

    if (!commonMatchId) {
      Toast.show({
        type: "themedWarning",
        text1: "No Common Match",
        text2: "Please select a common match that all players will drink for.",
        position: "bottom",
      });
      return;
    }

    const assignedMatchIds = new Set(Object.values(playerAssignments).flat());
    const filteredMatches = matches.filter(
      (match) =>
        assignedMatchIds.has(match.id) ||
        (commonMatchId && match.id === commonMatchId)
    );
    setGlobalMatches(filteredMatches);

    // If in a room, sync filtered matches FIRST, then set gameStarted flag
    if (currentRoom?.code) {
      // Explicitly sync filtered matches before setting gameStarted
      syncMatchesToRoom(currentRoom.code, filteredMatches);

      // Small delay to ensure matches are synced before guests navigate
      setTimeout(() => {
        hasNavigatedToGameRef.current = true; // Prevent host from re-navigating on subscription update
        syncGameStartedToRoom(currentRoom.code);
      }, 200);
    }

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
   * Randomly assign matches to players using distribution rules (balance & uniqueness).
   *
   * This creates a distribution where:
   * 1. All players get the common match.
   * 2. Each pair of players shares exactly one additional unique match.
   * 3. Extra individual matches are assigned as needed to reach target count per player.
   *
   * Ensures no player pair shares more than two matches total (common + unique pair match).
   *
   * @param {number} numMatches Additional matches each player should have beyond the common match (total per player = numMatches + 1).
   * @throws {Error} If constraints cannot be satisfied (missing common match, insufficient matches, or distribution failure).
   * @note Minimum required matches: 1 (common) + n(n-1)/2 (pairs) + extra if numMatches > n, where n = number of players.
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
          `Need ${totalMatchesNeeded} matches (${pairCount} pair + ${extraMatchesTotal} extra) for ${numPlayers} players with ${numMatches} additional each`
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
      Toast.show({
        type: "themedSuccess",
        text1: "Matches assigned",
        text2: `Each player has ${numMatches} additional matches plus the common match.`,
        position: "bottom",
      });
    } catch (error: any) {
      Toast.show({
        type: "themedWarning",
        text1: "Failed",
        text2: error.message || "Unknown error.",
        position: "bottom",
      });
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Tab Navigation */}
      <SetupWizard
        renderPlayersStep={renderPlayersStep}
        renderMatchesStep={renderMatchesStep}
        renderCommonMatchStep={renderCommonMatchStep}
        renderAssignStep={renderAssignStep}
        handleStartGame={handleStartGame}
        canAdvanceToMatches={canAdvanceToMatches}
        canAdvanceToCommonMatch={canAdvanceToCommonMatch}
        canAdvanceToAssign={canAdvanceToAssign}
        canStartGame={canStartGame}
        newPlayerName={newPlayerName}
        handleAddPlayer={handleAddPlayer}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        isHost={isHost}
      />
    </SafeAreaView>
  );
};

export default SetupGameScreen;
