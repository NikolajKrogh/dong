/**
 * useGameStateSync Hook
 *
 * React hook that syncs Gun.js game state with Zustand store
 */

import { useEffect, useCallback, useState } from "react";
import { useGameStore, Player, Match } from "../store/store";
import {
  initializeGameState,
  getGameState,
  addPlayer as addPlayerToGun,
  removePlayer as removePlayerFromGun,
  addMatch as addMatchToGun,
  removeMatch as removeMatchFromGun,
  updateMatchScore as updateMatchScoreInGun,
  setCommonMatch as setCommonMatchInGun,
  updatePlayerAssignments as updatePlayerAssignmentsInGun,
  updateGamePhase,
  recordPlayerDrink as recordPlayerDrinkInGun,
  subscribeToGameState,
  getSyncStatus as getGunSyncStatus,
} from "../utils/gameStateSync";
import { SyncedGameState, SyncStatus } from "../types/gameState";

export interface UseGameStateSyncReturn {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Whether game state is syncing */
  isSyncing: boolean;
  /** Initialize game state for host */
  initializeGame: () => Promise<void>;
  /** Sync current store state to Gun */
  syncToGun: () => Promise<void>;
  /** Pull latest state from Gun */
  pullFromGun: () => Promise<void>;
  /** Add player (synced) */
  addPlayer: (player: Player) => Promise<void>;
  /** Remove player (synced) */
  removePlayer: (playerId: string) => Promise<void>;
  /** Add match (synced) */
  addMatch: (match: Match) => Promise<void>;
  /** Remove match (synced) */
  removeMatch: (matchId: string) => Promise<void>;
  /** Update match score (synced) */
  updateMatchScore: (
    matchId: string,
    homeGoals: number,
    awayGoals: number
  ) => Promise<void>;
  /** Set common match (synced) */
  setCommonMatch: (matchId: string | null) => Promise<void>;
  /** Update player assignments (synced) */
  updateAssignments: (assignments: {
    [playerId: string]: string[];
  }) => Promise<void>;
  /** Record player drink (synced) */
  recordDrink: (playerId: string) => Promise<void>;
  /** Start game (change phase to in-progress) */
  startGame: () => Promise<void>;
  /** Finish game (change phase to finished) */
  finishGame: () => Promise<void>;
}

/**
 * Hook to sync game state between Gun.js and Zustand store
 */
export const useGameStateSync = (): UseGameStateSyncReturn => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("disconnected");
  const [isSyncing, setIsSyncing] = useState(false);

  const currentRoom = useGameStore((state) => state.currentRoom);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const setMatches = useGameStore((state) => state.setMatches);
  const setCommonMatchId = useGameStore((state) => state.setCommonMatchId);
  const setPlayerAssignments = useGameStore(
    (state) => state.setPlayerAssignments
  );
  const setMatchesPerPlayer = useGameStore(
    (state) => state.setMatchesPerPlayer
  );

  const roomCode = currentRoom?.code;

  /**
   * Apply Gun state to Zustand store
   */
  const applyStateToStore = useCallback(
    (state: SyncedGameState) => {
      console.log("🔄 Applying Gun state to Zustand store");
      setPlayers(state.players);
      setMatches(state.matches);
      setCommonMatchId(state.commonMatchId);
      setPlayerAssignments(state.playerAssignments);
      setMatchesPerPlayer(state.matchesPerPlayer);
    },
    [
      setPlayers,
      setMatches,
      setCommonMatchId,
      setPlayerAssignments,
      setMatchesPerPlayer,
    ]
  );

  /**
   * Subscribe to Gun updates
   */
  useEffect(() => {
    if (!roomCode) {
      setSyncStatus("disconnected");
      return;
    }

    console.log("👂 Setting up game state sync for room:", roomCode);

    const unsubscribe = subscribeToGameState(roomCode, (state, status) => {
      setSyncStatus(status);
      if (state) {
        applyStateToStore(state);
      }
    });

    // Check initial status
    const initialStatus = getGunSyncStatus(roomCode);
    setSyncStatus(initialStatus);

    return () => {
      console.log("🔇 Cleaning up game state sync");
      unsubscribe();
    };
  }, [roomCode, applyStateToStore]);

  /**
   * Auto-sync room players to game players
   * When someone joins the room, automatically add them as a game player
   */
  useEffect(() => {
    if (!currentRoom || !roomCode) return;

    const syncRoomPlayersToGame = async () => {
      const currentPlayers = useGameStore.getState().players;
      const roomPlayers = currentRoom.players;

      // Find new players that aren't in the game yet
      const newPlayers = roomPlayers.filter(
        (rp) => !currentPlayers.some((gp) => gp.id === rp.id)
      );

      if (newPlayers.length > 0) {
        console.log(
          "👥 Auto-adding",
          newPlayers.length,
          "new room players to game"
        );

        // Add each new player
        for (const newPlayer of newPlayers) {
          const gamePlayer: Player = {
            id: newPlayer.id,
            name: newPlayer.name,
            drinksTaken: 0,
          };

          // Add to game state
          try {
            await addPlayerToGun(roomCode, gamePlayer);
          } catch (error) {
            console.error("❌ Failed to auto-add player:", error);
          }
        }
      }
    };

    syncRoomPlayersToGame();
  }, [currentRoom?.players, roomCode]);

  /**
   * Initialize game state (host only)
   */
  const initializeGame = useCallback(async () => {
    if (!roomCode || !currentPlayerId || !currentRoom) {
      console.error("❌ Cannot initialize: missing room or player ID");
      return;
    }

    setIsSyncing(true);
    try {
      console.log("🎲 Initializing game state with room players...");

      // Convert room players to the format needed for game state
      const roomPlayers = currentRoom.players.map((p) => ({
        id: p.id,
        name: p.name,
      }));

      const state = await initializeGameState(
        roomCode,
        currentPlayerId,
        roomPlayers
      );
      applyStateToStore(state);
      setSyncStatus("synced");
      console.log(
        "✅ Game state initialized with",
        roomPlayers.length,
        "players"
      );
    } catch (error) {
      console.error("❌ Failed to initialize game state:", error);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }, [roomCode, currentPlayerId, currentRoom, applyStateToStore]);

  /**
   * Sync current store state to Gun
   */
  const syncToGun = useCallback(async () => {
    if (!roomCode) return;

    setIsSyncing(true);
    try {
      // This would push current store state to Gun
      // For now, we rely on individual operations
      console.log("🔄 Syncing store to Gun...");
      setSyncStatus("synced");
    } catch (error) {
      console.error("❌ Sync to Gun failed:", error);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }, [roomCode]);

  /**
   * Pull latest state from Gun
   */
  const pullFromGun = useCallback(async () => {
    if (!roomCode) return;

    setIsSyncing(true);
    try {
      console.log("📥 Pulling from Gun...");
      const state = await getGameState(roomCode);
      if (state) {
        applyStateToStore(state);
        setSyncStatus("synced");
      } else {
        setSyncStatus("error");
      }
    } catch (error) {
      console.error("❌ Pull from Gun failed:", error);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }, [roomCode, applyStateToStore]);

  /**
   * Add player (synced)
   */
  const addPlayer = useCallback(
    async (player: Player) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await addPlayerToGun(roomCode, player);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to add player:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Remove player (synced)
   */
  const removePlayer = useCallback(
    async (playerId: string) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await removePlayerFromGun(roomCode, playerId);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to remove player:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Add match (synced)
   */
  const addMatch = useCallback(
    async (match: Match) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await addMatchToGun(roomCode, match);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to add match:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Remove match (synced)
   */
  const removeMatch = useCallback(
    async (matchId: string) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await removeMatchFromGun(roomCode, matchId);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to remove match:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Update match score (synced)
   */
  const updateMatchScore = useCallback(
    async (matchId: string, homeGoals: number, awayGoals: number) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await updateMatchScoreInGun(
          roomCode,
          matchId,
          homeGoals,
          awayGoals
        );
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to update match score:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Set common match (synced)
   */
  const setCommonMatch = useCallback(
    async (matchId: string | null) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await setCommonMatchInGun(roomCode, matchId);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to set common match:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Update player assignments (synced)
   */
  const updateAssignments = useCallback(
    async (assignments: { [playerId: string]: string[] }) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await updatePlayerAssignmentsInGun(roomCode, assignments);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to update assignments:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Record player drink (synced)
   */
  const recordDrink = useCallback(
    async (playerId: string) => {
      if (!roomCode) return;

      setIsSyncing(true);
      try {
        const state = await recordPlayerDrinkInGun(roomCode, playerId);
        if (state) {
          applyStateToStore(state);
        }
      } catch (error) {
        console.error("❌ Failed to record drink:", error);
      } finally {
        setIsSyncing(false);
      }
    },
    [roomCode, applyStateToStore]
  );

  /**
   * Start game (change phase to in-progress)
   */
  const startGame = useCallback(async () => {
    if (!roomCode) return;

    setIsSyncing(true);
    try {
      const state = await updateGamePhase(roomCode, "in-progress");
      if (state) {
        applyStateToStore(state);
      }
    } catch (error) {
      console.error("❌ Failed to start game:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [roomCode, applyStateToStore]);

  /**
   * Finish game (change phase to finished)
   */
  const finishGame = useCallback(async () => {
    if (!roomCode) return;

    setIsSyncing(true);
    try {
      const state = await updateGamePhase(roomCode, "finished");
      if (state) {
        applyStateToStore(state);
      }
    } catch (error) {
      console.error("❌ Failed to finish game:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [roomCode, applyStateToStore]);

  return {
    syncStatus,
    isSyncing,
    initializeGame,
    syncToGun,
    pullFromGun,
    addPlayer,
    removePlayer,
    addMatch,
    removeMatch,
    updateMatchScore,
    setCommonMatch,
    updateAssignments,
    recordDrink,
    startGame,
    finishGame,
  };
};
