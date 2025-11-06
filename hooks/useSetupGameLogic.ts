import React from "react";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useGameStore, Player, Match } from "../store/store";
import type { GameRoom } from "../types/room";
import { getDeviceId } from "../utils/deviceId";
import {
  subscribeToRoom,
  subscribeToSetupSnapshot,
  syncSetupSnapshotToRoom,
  syncMatchesToRoom,
  syncAssignmentsToRoom,
  syncGameStartedToRoom,
  leaveRoom,
  type SetupSnapshotPayload,
  type AssignmentEnvelope,
} from "../utils/roomManager";
import { generateRandomAssignments } from "../utils/matchAssignments";

/**
 * Callback type for updating the global matches array in the Zustand store.
 * Accepts either a new array or an updater function.
 */
type MatchesUpdater = (matches: Match[] | ((prev: Match[]) => Match[])) => void;

/**
 * Mapping of player IDs to arrays of assigned match IDs.
 */
type PlayerAssignmentsState = Record<string, string[]>;

interface SetupSnapshotSignatureInput {
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: PlayerAssignmentsState;
  matchesPerPlayer: number;
  currentStep: number;
}

/**
 * Produce a stable JSON signature for the setup snapshot payload to detect meaningful changes.
 * Sorts object keys to avoid false positives caused by enumeration order differences.
 */
const createSetupSnapshotSignature = (
  snapshot: SetupSnapshotSignatureInput
): string => {
  return JSON.stringify(snapshot, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return Object.keys(record)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = record[key];
          return acc;
        }, {});
    }
    return value;
  });
};

const createAssignmentsHash = (assignments: PlayerAssignmentsState): string => {
  const sorted = Object.keys(assignments)
    .sort()
    .reduce<Record<string, string[]>>((acc, playerId) => {
      const matches = assignments[playerId] || [];
      acc[playerId] = [...matches].sort();
      return acc;
    }, {});

  return JSON.stringify(sorted);
};

/**
 * Return type for the useSetupGameLogic hook, aggregating all state and handlers for the setup wizard.
 */
export interface SetupGameHookResult {
  currentRoom: GameRoom | null;
  currentPlayerId: string | null;
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: PlayerAssignmentsState;
  matchesPerPlayer: number;
  setMatchesPerPlayer: (value: number) => void;
  setGlobalMatches: MatchesUpdater;
  newPlayerName: string;
  setNewPlayerName: React.Dispatch<React.SetStateAction<string>>;
  homeTeam: string;
  setHomeTeam: React.Dispatch<React.SetStateAction<string>>;
  awayTeam: string;
  setAwayTeam: React.Dispatch<React.SetStateAction<string>>;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  isHost: boolean;
  canAdvanceToMatches: boolean;
  canAdvanceToCommonMatch: boolean;
  canAdvanceToAssign: boolean;
  canStartGame: boolean;
  handleAddPlayer: () => Promise<void>;
  handleAddPlayerByName: (playerName: string) => Promise<void>;
  handleRemovePlayer: (playerId: string) => Promise<void>;
  handleAddMatch: () => void;
  handleRemoveMatch: (matchId: string) => void;
  handleSelectCommonMatch: (matchId: string) => void;
  toggleMatchAssignment: (playerId: string, matchId: string) => void;
  handleLeaveRoom: () => void;
  handleStartGame: () => void;
  handleRandomAssignment: (additionalMatches: number) => void;
}

/**
 * Aggregate all state, derived booleans, and callbacks required to drive the multi-step setup wizard.
 * Provides all state and handler callbacks for the setup flow, including multiplayer sync, match assignment, and navigation.
 * @returns {SetupGameHookResult} Hook API consumed by `SetupGameScreen`.
 */
const useSetupGameLogic = (): SetupGameHookResult => {
  const router = useRouter();
  const {
    currentRoom,
    currentPlayerId,
    setCurrentPlayerId,
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

  const [newPlayerName, setNewPlayerName] = React.useState("");
  const [homeTeam, setHomeTeam] = React.useState("");
  const [awayTeam, setAwayTeam] = React.useState("");
  const [currentStep, setCurrentStep] = React.useState(0);

  const isSyncingFromGunRef = React.useRef(false);
  const subscribedRoomRef = React.useRef<string | null>(null);
  const isHostRef = React.useRef(false);
  const hasNavigatedToGameRef = React.useRef(false);
  const latestSnapshotRef = React.useRef<{
    version: number;
    hash: string;
  } | null>(null);
  const subscribedSnapshotRoomRef = React.useRef<string | null>(null);
  const assignmentsVersionRef = React.useRef(0);
  const latestAssignmentsRef = React.useRef<{
    version: number;
    hash: string;
    authorId: string | null;
  } | null>(null);

  const isHost = currentRoom?.hostId === currentPlayerId;

  const applyAssignmentsEnvelope = React.useCallback(
    (envelope: AssignmentEnvelope, options?: { alreadyApplied?: boolean }) => {
      const { alreadyApplied = false } = options ?? {};

      const assignmentsHash = createAssignmentsHash(envelope.assignments);
      const latest = latestAssignmentsRef.current;

      if (latest) {
        if (envelope.version < latest.version) {
          return;
        }

        if (
          envelope.version === latest.version &&
          latest.hash === assignmentsHash
        ) {
          latestAssignmentsRef.current = {
            version: envelope.version,
            hash: assignmentsHash,
            authorId: envelope.authorId,
          };
          assignmentsVersionRef.current = Math.max(
            assignmentsVersionRef.current,
            envelope.version
          );
          return;
        }
      }

      latestAssignmentsRef.current = {
        version: envelope.version,
        hash: assignmentsHash,
        authorId: envelope.authorId,
      };
      assignmentsVersionRef.current = Math.max(
        assignmentsVersionRef.current,
        envelope.version
      );

      const localPlayerId = useGameStore.getState().currentPlayerId;
      const authoredBySelf =
        localPlayerId != null && envelope.authorId === localPlayerId;

      if (alreadyApplied || authoredBySelf) {
        return;
      }

      isSyncingFromGunRef.current = true;
      setGlobalPlayerAssignments(envelope.assignments);
      setTimeout(() => {
        isSyncingFromGunRef.current = false;
      }, 100);
    },
    [setGlobalPlayerAssignments]
  );

  // Track host status in a ref for multiplayer sync logic
  React.useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // On initial mount, if joining a room as host, initialize host player and assignments
  React.useEffect(() => {
    (async () => {
      if (
        currentRoom &&
        currentRoom.hostName &&
        players.length === 0 &&
        currentRoom.hostId
      ) {
        const deviceId = await getDeviceId();
        const hostPlayer: Player = {
          id: deviceId,
          name: currentRoom.hostName,
        };
        setGlobalPlayers([hostPlayer]);
        setGlobalPlayerAssignments({
          [hostPlayer.id]: [],
        });
        setCurrentPlayerId(deviceId);
      }
    })();
  }, [
    currentRoom,
    players.length,
    setCurrentPlayerId,
    setGlobalPlayers,
    setGlobalPlayerAssignments,
  ]);

  // Subscribe to Gun room updates and synchronize local state with remote room data
  React.useEffect(() => {
    if (!currentRoom?.code) {
      return;
    }

    if (subscribedRoomRef.current === currentRoom.code) {
      return;
    }

    subscribedRoomRef.current = currentRoom.code;

    const unsubscribe = subscribeToRoom(currentRoom.code, (updatedRoom) => {
      if (!updatedRoom) {
        return;
      }

      isSyncingFromGunRef.current = true;

      useGameStore.getState().setCurrentRoom(updatedRoom);

      const currentPlayers = useGameStore.getState().players;
      const roomPlayers = updatedRoom.players.map((rp) => ({
        id: rp.id,
        name: rp.name,
        drinksTaken: 0,
      }));

      const playerIdsInRoom = new Set(roomPlayers.map((p) => p.id));
      const playerIdsInGame = new Set(currentPlayers.map((p) => p.id));

      const newPlayers = roomPlayers.filter(
        (rp) => !playerIdsInGame.has(rp.id)
      );
      const removedPlayers = currentPlayers.filter(
        (cp) => !playerIdsInRoom.has(cp.id)
      );

      if (newPlayers.length > 0 || removedPlayers.length > 0) {
        const updatedPlayers = [
          ...currentPlayers.filter((cp) => playerIdsInRoom.has(cp.id)),
          ...newPlayers,
        ];

        setGlobalPlayers(updatedPlayers);

        const currentAssignments = useGameStore.getState().playerAssignments;
        const newAssignments = { ...currentAssignments };

        newPlayers.forEach((player) => {
          if (!newAssignments[player.id]) {
            newAssignments[player.id] = [];
          }
        });

        removedPlayers.forEach((player) => {
          delete newAssignments[player.id];
        });

        setGlobalPlayerAssignments(newAssignments);

        if (newPlayers.length > 0) {
          Toast.show({
            type: "success",
            text1: "Player Joined!",
            text2: newPlayers.map((p) => p.name).join(", "),
            position: "top",
          });
        }
      }

      const incomingAssignmentsJson = updatedRoom.playerAssignments;
      if (isHostRef.current && typeof incomingAssignmentsJson === "string") {
        try {
          const envelope = JSON.parse(
            incomingAssignmentsJson
          ) as AssignmentEnvelope;
          applyAssignmentsEnvelope(envelope);
        } catch (error) {
          console.error("Failed to parse assignments:", error);
        }
      }

      if (
        updatedRoom.gameStarted &&
        !isHostRef.current &&
        !hasNavigatedToGameRef.current
      ) {
        hasNavigatedToGameRef.current = true;
        router.push("/gameProgress");
      }

      setTimeout(() => {
        isSyncingFromGunRef.current = false;
      }, 100);
    });

    return () => {
      subscribedRoomRef.current = null;
      hasNavigatedToGameRef.current = false;
      unsubscribe();
    };
  }, [currentRoom?.code, router, setGlobalPlayers]);

  // Subscribe to canonical setup snapshots authored by the host
  React.useEffect(() => {
    if (!currentRoom?.code) {
      latestSnapshotRef.current = null;
      subscribedSnapshotRoomRef.current = null;
      return;
    }

    if (subscribedSnapshotRoomRef.current === currentRoom.code) {
      return;
    }

    subscribedSnapshotRoomRef.current = currentRoom.code;

    const unsubscribe = subscribeToSetupSnapshot(
      currentRoom.code,
      (snapshot: SetupSnapshotPayload | null) => {
        if (!snapshot) {
          latestSnapshotRef.current = null;
          return;
        }

        const snapshotBase: SetupSnapshotSignatureInput = {
          players: snapshot.players,
          matches: snapshot.matches,
          commonMatchId: snapshot.commonMatchId,
          playerAssignments: snapshot.playerAssignments,
          matchesPerPlayer: snapshot.matchesPerPlayer,
          currentStep: snapshot.currentStep,
        };

        const baseHash = createSetupSnapshotSignature(snapshotBase);
        const latest = latestSnapshotRef.current;

        if (latest) {
          if (snapshot.version < latest.version) {
            return;
          }

          if (snapshot.version === latest.version && latest.hash === baseHash) {
            return;
          }
        }

        latestSnapshotRef.current = {
          version: snapshot.version,
          hash: baseHash,
        };

        const localPlayerId = useGameStore.getState().currentPlayerId;
        if (localPlayerId && snapshot.authorId === localPlayerId) {
          return;
        }

        isSyncingFromGunRef.current = true;

        setGlobalPlayers(snapshot.players);
        setGlobalMatches(snapshot.matches);
        setGlobalCommonMatchId(snapshot.commonMatchId);
        setGlobalPlayerAssignments(snapshot.playerAssignments);
        setMatchesPerPlayer(snapshot.matchesPerPlayer);
        setCurrentStep(snapshot.currentStep);

        applyAssignmentsEnvelope(
          {
            version: snapshot.version,
            authorId: snapshot.authorId,
            updatedAt: snapshot.updatedAt,
            assignments: snapshot.playerAssignments,
          },
          { alreadyApplied: true }
        );

        setTimeout(() => {
          isSyncingFromGunRef.current = false;
        }, 100);
      }
    );

    return () => {
      subscribedSnapshotRoomRef.current = null;
      latestSnapshotRef.current = null;
      unsubscribe();
    };
  }, [
    currentRoom?.code,
    setCurrentStep,
    setGlobalCommonMatchId,
    setGlobalMatches,
    setGlobalPlayerAssignments,
    setGlobalPlayers,
    setMatchesPerPlayer,
    applyAssignmentsEnvelope,
  ]);

  // Publish a fresh canonical snapshot whenever the authoritative host state changes
  React.useEffect(() => {
    if (!currentRoom?.code || !isHost || !currentPlayerId) {
      return;
    }

    const snapshotBase: SetupSnapshotSignatureInput = {
      players,
      matches,
      commonMatchId,
      playerAssignments,
      matchesPerPlayer,
      currentStep,
    };

    const baseHash = createSetupSnapshotSignature(snapshotBase);
    const latest = latestSnapshotRef.current;

    if (latest && latest.hash === baseHash) {
      return;
    }

    const nextVersion = (latest?.version ?? 0) + 1;

    const payload: SetupSnapshotPayload = {
      version: nextVersion,
      authorId: currentPlayerId,
      updatedAt: Date.now(),
      ...snapshotBase,
    };

    syncSetupSnapshotToRoom(currentRoom.code, payload);

    latestSnapshotRef.current = {
      version: nextVersion,
      hash: baseHash,
    };
    applyAssignmentsEnvelope(
      {
        version: nextVersion,
        authorId: currentPlayerId,
        updatedAt: payload.updatedAt,
        assignments: playerAssignments,
      },
      { alreadyApplied: true }
    );
  }, [
    currentRoom?.code,
    isHost,
    currentPlayerId,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer,
    currentStep,
    applyAssignmentsEnvelope,
  ]);

  const canAdvanceToMatches = players.length > 0;
  const canAdvanceToCommonMatch = matches.length > 0;
  const canAdvanceToAssign = matches.length >= 1 && commonMatchId !== null;
  const canStartGame =
    players.length > 0 && matches.length > 0 && commonMatchId !== null;

  /**
   * Persist the current device as a player (or update the stored name) and ensure assignments are initialised.
   * If the player already exists, updates their name. Otherwise, adds a new player and initializes assignments.
   * Shows a toast notification on update.
   * @returns {Promise<void>}
   */
  const handleAddPlayer = React.useCallback(async () => {
    if (!newPlayerName.trim()) {
      return;
    }

    const deviceId = await getDeviceId();
    const existingPlayer = players.find((p) => p.id === deviceId);

    if (existingPlayer) {
      if (existingPlayer.name !== newPlayerName.trim()) {
        setGlobalPlayers(
          players.map((p) =>
            p.id === deviceId ? { ...p, name: newPlayerName.trim() } : p
          )
        );
        Toast.show({
          type: "info",
          text1: "Player Updated",
          text2: `Name changed to ${newPlayerName.trim()}`,
          position: "bottom",
        });
      }
    } else {
      const newPlayer: Player = {
        id: deviceId,
        name: newPlayerName.trim(),
      };
      setGlobalPlayers([...players, newPlayer]);
      setGlobalPlayerAssignments({
        ...playerAssignments,
        [newPlayer.id]: [],
      });
      setCurrentPlayerId(deviceId);
    }

    setNewPlayerName("");
  }, [
    newPlayerName,
    playerAssignments,
    players,
    setCurrentPlayerId,
    setGlobalPlayerAssignments,
    setGlobalPlayers,
  ]);

  /**
   * Variant used by the suggestion dropdown to map the current device ID to a selected historic name.
   * If the player already exists, updates their name. Otherwise, adds a new player and initializes assignments.
   * @param {string} playerName - Name to assign to the current device/player.
   * @returns {Promise<void>}
   */
  const handleAddPlayerByName = React.useCallback(
    async (playerName: string) => {
      if (!playerName.trim()) {
        return;
      }

      const deviceId = await getDeviceId();
      const existingPlayer = players.find((p) => p.id === deviceId);

      if (existingPlayer) {
        if (existingPlayer.name !== playerName.trim()) {
          setGlobalPlayers(
            players.map((p) =>
              p.id === deviceId ? { ...p, name: playerName.trim() } : p
            )
          );
        }
      } else {
        const newPlayer: Player = {
          id: deviceId,
          name: playerName.trim(),
        };
        setGlobalPlayers([...players, newPlayer]);
        setGlobalPlayerAssignments({
          ...playerAssignments,
          [newPlayer.id]: [],
        });
        setCurrentPlayerId(deviceId);
      }
    },
    [
      playerAssignments,
      players,
      setCurrentPlayerId,
      setGlobalPlayerAssignments,
      setGlobalPlayers,
    ]
  );

  /**
   * Remove a player from the roster and tidy up any assignments associated with the given player ID.
   * If the removed player is the current device, clears the current player ID.
   * @param {string} playerId - ID of the player to remove.
   * @returns {Promise<void>}
   */
  const handleRemovePlayer = React.useCallback(
    async (playerId: string) => {
      setGlobalPlayers((prev) =>
        prev.filter((player) => player.id !== playerId)
      );

      setGlobalPlayerAssignments((prevAssignments) => {
        const newAssignments: Record<string, string[]> = { ...prevAssignments };
        delete newAssignments[playerId];
        return newAssignments;
      });

      const deviceId = await getDeviceId();
      if (playerId === deviceId) {
        setCurrentPlayerId(null);
      }
    },
    [setCurrentPlayerId, setGlobalPlayerAssignments, setGlobalPlayers]
  );

  /**
   * Add a custom match using the current home and away team text inputs.
   * Resets the home and away team input fields after adding.
   */
  const handleAddMatch = React.useCallback(() => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      return;
    }

    const newMatch: Match = {
      id: String(Date.now()),
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeGoals: 0,
      awayGoals: 0,
    };

    setGlobalMatches([...matches, newMatch]);
    setHomeTeam("");
    setAwayTeam("");
  }, [awayTeam, homeTeam, matches, setGlobalMatches]);

  /**
   * Remove a match and detach any assignments or common match references pointing at it.
   * If the removed match is the common match, clears the common match selection.
   * @param {string} matchId - ID of the match to remove.
   */
  const handleRemoveMatch = React.useCallback(
    (matchId: string) => {
      setGlobalMatches((prevMatches) =>
        prevMatches.filter((match) => match.id !== matchId)
      );

      setGlobalPlayerAssignments((prevAssignments) => {
        const newAssignments: Record<string, string[]> = {};
        for (const playerId in prevAssignments) {
          if (Object.prototype.hasOwnProperty.call(prevAssignments, playerId)) {
            newAssignments[playerId] = prevAssignments[playerId].filter(
              (id) => id !== matchId
            );
          }
        }
        return newAssignments;
      });

      if (commonMatchId === matchId) {
        setGlobalCommonMatchId(null);
      }
    },
    [
      commonMatchId,
      setGlobalCommonMatchId,
      setGlobalMatches,
      setGlobalPlayerAssignments,
    ]
  );

  /**
   * Update the shared common match for all players.
   * @param {string} matchId - ID of the match to set as the common match.
   */
  const handleSelectCommonMatch = React.useCallback(
    (matchId: string) => {
      setGlobalCommonMatchId(matchId);
    },
    [setGlobalCommonMatchId]
  );

  /**
   * Toggle a match assignment for a specific player, preserving immutability of the assignment map.
   * Adds or removes the match from the player's assignment list.
   * @param {string} playerId - ID of the player.
   * @param {string} matchId - ID of the match to toggle.
   */
  const toggleMatchAssignment = React.useCallback(
    (playerId: string, matchId: string) => {
      if (!isHost && currentPlayerId && playerId !== currentPlayerId) {
        Toast.show({
          type: "info",
          text1: "Only your matches",
          text2: "You can only change your own assignments.",
          position: "bottom",
        });
        return;
      }

      if (!isHost && !currentPlayerId) {
        return;
      }

      const shouldBroadcast =
        !isHost && Boolean(currentRoom?.code) && !isSyncingFromGunRef.current;

      const authorId =
        currentPlayerId ??
        (isHost && currentRoom?.hostId ? currentRoom.hostId : "unknown");

      const nextVersion = assignmentsVersionRef.current + 1;
      const updatedAt = Date.now();

      let nextAssignments: Record<string, string[]> | null = null;

      setGlobalPlayerAssignments((prevAssignments) => {
        const currentAssignments = prevAssignments[playerId] || [];
        const index = currentAssignments.indexOf(matchId);

        const newAssignments = [...currentAssignments];
        if (index === -1) {
          newAssignments.push(matchId);
        } else {
          newAssignments.splice(index, 1);
        }

        nextAssignments = {
          ...prevAssignments,
          [playerId]: newAssignments,
        };

        return nextAssignments;
      });

      if (!nextAssignments) {
        return;
      }

      const envelope: AssignmentEnvelope = {
        version: nextVersion,
        authorId,
        updatedAt,
        assignments: nextAssignments,
      };

      applyAssignmentsEnvelope(envelope, { alreadyApplied: true });

      if (shouldBroadcast && currentRoom?.code) {
        syncAssignmentsToRoom(currentRoom.code, envelope);
      }
    },
    [
      applyAssignmentsEnvelope,
      currentPlayerId,
      currentRoom?.code,
      currentRoom?.hostId,
      isHost,
      setGlobalPlayerAssignments,
    ]
  );

  /**
   * Leave the active room, clear local state, and navigate back to the landing screen.
   * Shows a toast notification and resets multiplayer state.
   */
  const handleLeaveRoom = React.useCallback(() => {
    if (!currentRoom?.code || !currentPlayerId) {
      return;
    }

    leaveRoom(currentRoom.code, currentPlayerId);

    const store = useGameStore.getState();
    store.setCurrentRoom(null);
    store.setCurrentPlayerId(null);
    store.resetState();
    store.setRoomConnectionStatus("disconnected");

    hasNavigatedToGameRef.current = false;

    Toast.show({
      type: "info",
      text1: "Left Room",
      text2: `You have left room ${currentRoom.code}`,
      position: "bottom",
    });

    router.push("/");
  }, [currentPlayerId, currentRoom?.code, router]);

  /**
   * Validate prerequisites, sync filtered matches, flip the game-start flag, and transition to gameplay.
   * Shows warnings if required setup steps are missing.
   */
  const handleStartGame = React.useCallback(() => {
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

    if (currentRoom?.code) {
      syncMatchesToRoom(currentRoom.code, filteredMatches);

      setTimeout(() => {
        hasNavigatedToGameRef.current = true;
        syncGameStartedToRoom(currentRoom.code);
      }, 200);
    }

    router.push("/gameProgress");
  }, [
    commonMatchId,
    currentRoom?.code,
    matches,
    playerAssignments,
    players.length,
    router,
    setGlobalMatches,
  ]);

  /**
   * Trigger balanced random assignments for each player, surfacing any constraint errors via toast messages.
   * Uses the assignment utility to generate assignments and updates the store.
   * @param {number} numMatches - Number of additional matches per player (excluding the common match).
   */
  const handleRandomAssignment = React.useCallback(
    (numMatches: number) => {
      try {
        const assignments = generateRandomAssignments(
          players,
          matches,
          commonMatchId,
          numMatches
        );

        setGlobalPlayerAssignments(assignments);
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
          text2: error?.message || "Unknown error.",
          position: "bottom",
        });
        console.error(error);
      }
    },
    [commonMatchId, matches, players, setGlobalPlayerAssignments]
  );

  return {
    currentRoom,
    currentPlayerId,
    players,
    matches,
    commonMatchId,
    playerAssignments,
    matchesPerPlayer,
    setMatchesPerPlayer,
    setGlobalMatches,
    newPlayerName,
    setNewPlayerName,
    homeTeam,
    setHomeTeam,
    awayTeam,
    setAwayTeam,
    currentStep,
    setCurrentStep,
    isHost,
    canAdvanceToMatches,
    canAdvanceToCommonMatch,
    canAdvanceToAssign,
    canStartGame,
    handleAddPlayer,
    handleAddPlayerByName,
    handleRemovePlayer,
    handleAddMatch,
    handleRemoveMatch,
    handleSelectCommonMatch,
    toggleMatchAssignment,
    handleLeaveRoom,
    handleStartGame,
    handleRandomAssignment,
  };
};

export default useSetupGameLogic;
