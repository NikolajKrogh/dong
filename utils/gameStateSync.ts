/**
 * Game State Synchronization with Gun.js
 *
 * Handles real-time synchronization of game state between peers
 * Uses hybrid approach: Gun for P2P sync + local state for instant updates
 */

import gun from "./gunConfig";
import {
  SyncedGameState,
  GameStateUpdate,
  GameStateUpdateType,
  GunGameState,
  SyncStatus,
} from "../types/gameState";
import { Player, Match } from "../store/store";

// Detect test environment
const isTestEnv =
  typeof jest !== "undefined" || process.env.NODE_ENV === "test";

// Local cache for instant access
const gameStateCache = new Map<string, SyncedGameState>();
const syncStatusCache = new Map<string, SyncStatus>();

if (!isTestEnv) {
  console.log("🎮 Game state sync initialized");
}

/**
 * Initialize game state for a room
 */
export const initializeGameState = async (
  roomCode: string,
  hostPlayerId: string,
  roomPlayers?: Array<{ id: string; name: string }>
): Promise<SyncedGameState> => {
  const normalizedCode = roomCode.toUpperCase();

  // Convert room players to game players
  const gamePlayers: Player[] = roomPlayers
    ? roomPlayers.map((rp) => ({
        id: rp.id,
        name: rp.name,
        drinksTaken: 0,
      }))
    : [];

  const initialState: SyncedGameState = {
    version: 1,
    lastUpdated: Date.now(),
    players: gamePlayers,
    matches: [],
    commonMatchId: null,
    playerAssignments: {},
    matchesPerPlayer: 3,
    phase: "setup",
  };

  if (!isTestEnv) {
    console.log(
      "🎲 Initializing game state for room:",
      normalizedCode,
      "with",
      gamePlayers.length,
      "players from room"
    );
  }

  // Store in local cache
  gameStateCache.set(normalizedCode, initialState);
  syncStatusCache.set(normalizedCode, "syncing");

  // Store in Gun
  return new Promise((resolve) => {
    const gameRef = gun.get("games").get(normalizedCode);
    const stateJson = JSON.stringify(initialState);

    gameRef.get("roomCode").put(normalizedCode);
    gameRef.get("state").put(stateJson);

    if (!isTestEnv) {
      console.log("✅ Game state initialized and syncing");
    }

    syncStatusCache.set(normalizedCode, "synced");

    setTimeout(() => resolve(initialState), 100);
  });
};

/**
 * Get current game state
 */
export const getGameState = async (
  roomCode: string
): Promise<SyncedGameState | null> => {
  const normalizedCode = roomCode.toUpperCase();

  // Check cache first
  const cached = gameStateCache.get(normalizedCode);
  if (cached) {
    return cached;
  }

  if (!isTestEnv) {
    console.log("🔍 Fetching game state from Gun:", normalizedCode);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const gameRef = gun.get("games").get(normalizedCode);

    const listener = gameRef.get("state").on((stateJson: any) => {
      if (resolved || !stateJson) return;

      try {
        const state = JSON.parse(stateJson) as SyncedGameState;
        gameStateCache.set(normalizedCode, state);
        syncStatusCache.set(normalizedCode, "synced");

        if (!isTestEnv) {
          console.log("✅ Got game state from Gun");
        }

        if (listener) listener.off();
        resolved = true;
        resolve(state);
      } catch (e) {
        console.error("❌ Failed to parse game state:", e);
      }
    });

    // Timeout
    const timeoutMs = isTestEnv ? 1000 : 5000;
    setTimeout(() => {
      if (!resolved) {
        if (!isTestEnv) {
          console.log("⏱️ Game state fetch timeout");
        }
        if (listener) listener.off();
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);
  });
};

/**
 * Update game state
 */
export const updateGameState = async (
  roomCode: string,
  updater: (current: SyncedGameState) => SyncedGameState
): Promise<SyncedGameState | null> => {
  const normalizedCode = roomCode.toUpperCase();

  // Get current state
  const currentState =
    gameStateCache.get(normalizedCode) || (await getGameState(normalizedCode));
  if (!currentState) {
    console.error("❌ Cannot update: game state not found");
    return null;
  }

  // Apply update
  const newState = updater(currentState);
  newState.lastUpdated = Date.now();

  if (!isTestEnv) {
    console.log("🔄 Updating game state:", normalizedCode);
  }

  // Update cache
  gameStateCache.set(normalizedCode, newState);
  syncStatusCache.set(normalizedCode, "syncing");

  // Update Gun
  const gameRef = gun.get("games").get(normalizedCode);
  const stateJson = JSON.stringify(newState);
  gameRef.get("state").put(stateJson);

  syncStatusCache.set(normalizedCode, "synced");

  return newState;
};

/**
 * Add player to game
 */
export const addPlayer = async (
  roomCode: string,
  player: Player
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    players: [...state.players.filter((p) => p.id !== player.id), player],
  }));
};

/**
 * Remove player from game
 */
export const removePlayer = async (
  roomCode: string,
  playerId: string
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    players: state.players.filter((p) => p.id !== playerId),
  }));
};

/**
 * Add match to game
 */
export const addMatch = async (
  roomCode: string,
  match: Match
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    matches: [...state.matches.filter((m) => m.id !== match.id), match],
  }));
};

/**
 * Remove match from game
 */
export const removeMatch = async (
  roomCode: string,
  matchId: string
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    matches: state.matches.filter((m) => m.id !== matchId),
  }));
};

/**
 * Update match scores
 */
export const updateMatchScore = async (
  roomCode: string,
  matchId: string,
  homeGoals: number,
  awayGoals: number
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    matches: state.matches.map((m) =>
      m.id === matchId ? { ...m, homeGoals, awayGoals } : m
    ),
  }));
};

/**
 * Set common match
 */
export const setCommonMatch = async (
  roomCode: string,
  matchId: string | null
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    commonMatchId: matchId,
  }));
};

/**
 * Update player assignments
 */
export const updatePlayerAssignments = async (
  roomCode: string,
  assignments: { [playerId: string]: string[] }
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    playerAssignments: assignments,
  }));
};

/**
 * Update game phase
 */
export const updateGamePhase = async (
  roomCode: string,
  phase: SyncedGameState["phase"]
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    phase,
  }));
};

/**
 * Record player drink
 */
export const recordPlayerDrink = async (
  roomCode: string,
  playerId: string
): Promise<SyncedGameState | null> => {
  return updateGameState(roomCode, (state) => ({
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, drinksTaken: (p.drinksTaken || 0) + 1 } : p
    ),
  }));
};

/**
 * Subscribe to game state updates
 */
export const subscribeToGameState = (
  roomCode: string,
  callback: (state: SyncedGameState | null, status: SyncStatus) => void
): (() => void) => {
  const normalizedCode = roomCode.toUpperCase();
  const gameRef = gun.get("games").get(normalizedCode);
  let lastUpdate = 0;

  if (!isTestEnv) {
    console.log("👂 Subscribing to game state updates:", normalizedCode);
  }

  const listener = gameRef.get("state").on((stateJson: any) => {
    // Debounce updates
    const now = Date.now();
    if (now - lastUpdate < 300) return;
    lastUpdate = now;

    if (!stateJson) {
      callback(null, "disconnected");
      return;
    }

    try {
      const state = JSON.parse(stateJson) as SyncedGameState;
      gameStateCache.set(normalizedCode, state);
      syncStatusCache.set(normalizedCode, "synced");

      if (!isTestEnv) {
        console.log("📡 Game state update received");
      }

      callback(state, "synced");
    } catch (e) {
      console.error("❌ Failed to parse game state update:", e);
      callback(null, "error");
    }
  });

  // Return cleanup function
  return () => {
    if (!isTestEnv) {
      console.log("🔇 Unsubscribing from game state updates");
    }
    if (listener) listener.off();
  };
};

/**
 * Get current sync status
 */
export const getSyncStatus = (roomCode: string): SyncStatus => {
  const normalizedCode = roomCode.toUpperCase();
  return syncStatusCache.get(normalizedCode) || "disconnected";
};

/**
 * Clear local cache (for testing or cleanup)
 */
export const clearGameStateCache = (roomCode?: string): void => {
  if (roomCode) {
    const normalizedCode = roomCode.toUpperCase();
    gameStateCache.delete(normalizedCode);
    syncStatusCache.delete(normalizedCode);
  } else {
    gameStateCache.clear();
    syncStatusCache.clear();
  }
};
