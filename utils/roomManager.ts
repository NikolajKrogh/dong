/**
 * Gun.js Room Management Utilities
 *
 * Handles creation, joining, and management of game rooms using Gun.js
 * Uses hybrid approach: Gun for P2P sync + local cache for instant access
 */

import gun from "./gunConfig";
import { GameRoom, GunRoomData, RoomPlayer } from "../types/room";
import { Match, Player } from "../store/store";

/**
 * Represents a canonical snapshot of the setup state authored by the host.
 * Used for synchronizing all setup data between host and guests.
 */
export interface SetupSnapshotPayload {
  /** Monotonically increasing version number for snapshot ordering */
  version: number;
  /** Player ID of the author (host) */
  authorId: string;
  /** Timestamp of last update (ms since epoch) */
  updatedAt: number;
  /** List of all players in the room */
  players: Player[];
  /** List of all matches in the room */
  matches: Match[];
  /** The common match ID (or null if not set) */
  commonMatchId: string | null;
  /** Player assignments mapping (playerId -> matchIds[]) */
  playerAssignments: { [playerId: string]: string[] };
  /** Number of matches per player */
  matchesPerPlayer: number;
  /** Current setup wizard step */
  currentStep: number;
}

/**
 * Envelope for assignment sync, including version, author, and timestamp metadata.
 * Used to prevent echo/flicker loops and ensure only the latest assignments are applied.
 */
export interface AssignmentEnvelope {
  /** Monotonically increasing version number for assignment ordering */
  version: number;
  /** Player ID of the author */
  authorId: string;
  /** Timestamp of last update (ms since epoch) */
  updatedAt: number;
  /** Player assignments mapping (playerId -> matchIds[]) */
  assignments: { [playerId: string]: string[] };
}

/**
 * Envelope capturing match state updates with ordering metadata.
 */
export interface MatchesEnvelope {
  /** Monotonically increasing version number for match ordering */
  version: number;
  /** Player ID of the author */
  authorId: string;
  /** Timestamp of last update (ms since epoch) */
  updatedAt: number;
  /** Full collection of matches represented in the envelope */
  matches: Match[];
}

/**
 * Envelope encapsulating player drink totals with version metadata.
 */
export interface PlayerDrinksEnvelope {
  /** Monotonically increasing version number for drink ordering */
  version: number;
  /** Player ID of the author */
  authorId: string;
  /** Timestamp of last update (ms since epoch) */
  updatedAt: number;
  /** Mapping of player IDs to total drinks */
  playerDrinks: { [playerId: string]: number };
}

// Detect test environment
const isTestEnv =
  typeof jest !== "undefined" || process.env.NODE_ENV === "test";

// Local cache for instant access while Gun syncs in background
const localRoomCache = new Map<string, GunRoomData>();

if (!isTestEnv) {
}

const DEFAULT_AUTHOR_ID = "unknown";

const ensureMatchesEnvelope = (
  payload: Match[] | MatchesEnvelope
): MatchesEnvelope => {
  if (Array.isArray(payload)) {
    const timestamp = Date.now();
    return {
      version: timestamp,
      authorId: DEFAULT_AUTHOR_ID,
      updatedAt: timestamp,
      matches: payload,
    };
  }

  return payload;
};

const ensurePlayerDrinksEnvelope = (
  payload: { [playerId: string]: number } | PlayerDrinksEnvelope
): PlayerDrinksEnvelope => {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    !(payload as PlayerDrinksEnvelope).playerDrinks
  ) {
    const timestamp = Date.now();
    return {
      version: timestamp,
      authorId: DEFAULT_AUTHOR_ID,
      updatedAt: timestamp,
      playerDrinks: payload as { [playerId: string]: number },
    };
  }

  return payload as PlayerDrinksEnvelope;
};

/**
 * Generate a random 6-character room code (excluding ambiguous characters).
 * @returns {string} Room code
 */
export const generateRoomCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding ambiguous characters
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Generate a unique room ID for Gun.js rooms.
 * @returns {string} Room ID
 */
export const generateRoomId = (): string => {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new game room and store it in Gun.js and local cache.
 * @param {string} hostId - Host player ID
 * @param {string} hostName - Host player name
 * @param {number} [maxPlayers=10] - Maximum number of players
 * @returns {Promise<GameRoom>} The created room
 */
export const createRoom = async (
  hostId: string,
  hostName: string,
  maxPlayers: number = 10
): Promise<GameRoom> => {
  const roomId = generateRoomId();
  const roomCode = generateRoomCode();
  const now = Date.now();

  const hostPlayer: RoomPlayer = {
    id: hostId,
    name: hostName,
    isHost: true,
    joinedAt: now,
  };

  const roomData: GunRoomData = {
    id: roomId,
    code: roomCode,
    hostId,
    hostName,
    createdAt: now,
    maxPlayers,
    isLocked: false,
    players: {
      [hostId]: hostPlayer,
    },
  };

  // Store in local cache for instant access
  localRoomCache.set(roomCode, roomData);

  // Store in Gun for P2P sync using proper callback handling
  return new Promise<GameRoom>((resolve) => {
    const roomRef = gun.get("rooms").get(roomCode);

    // Set individual fields (Gun works better with flat structure)
    roomRef.get("id").put(roomId);
    roomRef.get("code").put(roomCode);
    roomRef.get("hostId").put(hostId);
    roomRef.get("hostName").put(hostName);
    roomRef.get("createdAt").put(now);
    roomRef.get("maxPlayers").put(maxPlayers);
    roomRef.get("isLocked").put(false);

    // Store host player
    roomRef.get("players").get(hostId).put(JSON.stringify(hostPlayer));

    // Return immediately (Gun syncs in background)
    setTimeout(() => {
      const room: GameRoom = {
        id: roomId,
        code: roomCode,
        hostId,
        hostName,
        players: [hostPlayer],
        createdAt: now,
        maxPlayers,
        isLocked: false,
      };

      resolve(room);
    }, 100);
  });
};

/**
 * Join an existing room by code, updating Gun.js and local cache.
 * @param {string} roomCode - Room code
 * @param {string} playerId - Player ID
 * @param {string} playerName - Player name
 * @returns {Promise<GameRoom|null>} The joined room or null if not found/full/locked
 */

export const joinRoom = async (
  roomCode: string,
  playerId: string,
  playerName: string
): Promise<GameRoom | null> => {
  const normalizedCode = roomCode.toUpperCase();
  const roomRef = gun.get("rooms").get(normalizedCode);

  // Helper: fetch a Gun.js field as a Promise
  function getRoomField(ref: any, field: string): Promise<any> {
    return new Promise((resolve) => {
      ref.get(field).once((val: any) => resolve(val));
    });
  }

  // Helper: parse players from Gun.js data
  function parsePlayers(playersData: any): RoomPlayer[] {
    const players: RoomPlayer[] = [];
    if (playersData) {
      for (const pId in playersData) {
        if (playersData[pId] && typeof playersData[pId] === "string") {
          try {
            const player = JSON.parse(playersData[pId]);
            players.push(player);
          } catch (e) {
            // Skip invalid player data
          }
        }
      }
    }
    return players;
  }

  // Try to join with room data
  const [id, hostId, hostName, createdAt, maxPlayers, isLocked, playersData] =
    await Promise.all([
      getRoomField(roomRef, "id"),
      getRoomField(roomRef, "hostId"),
      getRoomField(roomRef, "hostName"),
      getRoomField(roomRef, "createdAt"),
      getRoomField(roomRef, "maxPlayers"),
      getRoomField(roomRef, "isLocked"),
      getRoomField(roomRef, "players"),
    ]);

  if (!id || !hostId) {
    return null;
  }

  if (isLocked) {
    console.error("❌ Room is locked");
    return null;
  }

  const players: RoomPlayer[] = parsePlayers(playersData);
  const existingPlayerIndex = players.findIndex((p) => p.id === playerId);

  if (existingPlayerIndex >= 0) {
    // Player is reconnecting - update their info
    const updatedPlayer: RoomPlayer = {
      ...players[existingPlayerIndex],
      name: playerName,
      joinedAt: Date.now(),
    };
    roomRef.get("players").get(playerId).put(JSON.stringify(updatedPlayer));
    players[existingPlayerIndex] = updatedPlayer;
    console.log(
      `✅ Player ${playerName} reconnected to room ${normalizedCode}`
    );
  } else {
    // New player joining
    if (players.length >= (maxPlayers || 10)) {
      console.error("❌ Room is full");
      return null;
    }
    const newPlayer: RoomPlayer = {
      id: playerId,
      name: playerName,
      isHost: false,
      joinedAt: Date.now(),
    };
    roomRef.get("players").get(playerId).put(JSON.stringify(newPlayer));
    players.push(newPlayer);
    console.log(`✅ Player ${playerName} joined room ${normalizedCode}`);
  }

  const roomData: GunRoomData = {
    id,
    code: normalizedCode,
    hostId,
    hostName: hostName || "Host",
    createdAt: createdAt || Date.now(),
    maxPlayers: maxPlayers || 10,
    isLocked: isLocked || false,
    players: players.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
  };
  localRoomCache.set(normalizedCode, roomData);

  const room: GameRoom = {
    id,
    code: normalizedCode,
    hostId,
    hostName: hostName || "Host",
    players,
    createdAt: createdAt || Date.now(),
    maxPlayers: maxPlayers || 10,
    isLocked: isLocked || false,
  };

  // Also check local cache for instant join (if room was just created on this device)
  const cachedRoom = localRoomCache.get(normalizedCode);
  if (cachedRoom && !cachedRoom.players[playerId]) {
    const newPlayer: RoomPlayer = {
      id: playerId,
      name: playerName,
      isHost: false,
      joinedAt: Date.now(),
    };
    cachedRoom.players[playerId] = newPlayer;
    localRoomCache.set(normalizedCode, cachedRoom);
    roomRef.get("players").get(playerId).put(JSON.stringify(newPlayer));
    room.players = Object.values(cachedRoom.players);
  }

  return room;
};

/**
 * Leave a room, removing the player from Gun.js and local cache.
 * @param {string} roomCode - Room code
 * @param {string} playerId - Player ID to remove
 */
export const leaveRoom = (roomCode: string, playerId: string): void => {
  const normalizedCode = roomCode.toUpperCase();

  // Remove from local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData && roomData.players[playerId]) {
    delete roomData.players[playerId];
    localRoomCache.set(normalizedCode, roomData);
  }

  // Remove player from Gun.js
  gun.get("rooms").get(normalizedCode).get("players").get(playerId).put(null); // Set to null to remove
};

/**
 * Subscribe to room updates via Gun.js P2P and local cache.
 * @param {string} roomCode - Room code
 * @param {(room: GameRoom|null) => void} callback - Callback for room updates
 * @returns {() => void} Unsubscribe function
 */
export const subscribeToRoom = (
  roomCode: string,
  callback: (room: GameRoom | null) => void
): (() => void) => {
  const normalizedCode = roomCode.toUpperCase();
  const roomRef = gun.get("rooms").get(normalizedCode);
  let lastUpdate = 0;
  const listeners: any[] = [];

  /**
   * Fetch a Gun.js field as a Promise for async/await usage.
   * @param {any} ref - Gun.js node reference
   * @param {string} field - Field name to fetch
   * @returns {Promise<any>} Promise resolving to the field value
   */
  function getRoomField(ref: any, field: string): Promise<any> {
    return new Promise((resolve) => {
      ref.get(field).once((val: any) => resolve(val));
    });
  }

  /**
   * Parse players from Gun.js data, filtering out invalid and duplicate entries.
   * @param {any} playersData - Raw Gun.js players data
   * @returns {RoomPlayer[]} Array of parsed RoomPlayer objects
   */
  function parsePlayers(playersData: any): RoomPlayer[] {
    const players: RoomPlayer[] = [];
    const seenPlayerIds = new Set<string>();
    if (playersData) {
      for (const pId in playersData) {
        if (pId === "_") continue;
        const playerData = playersData[pId];
        if (playerData === null || playerData === undefined) continue;
        try {
          const player =
            typeof playerData === "string"
              ? JSON.parse(playerData)
              : playerData;
          if (player && player.id && player.name) {
            if (seenPlayerIds.has(player.id)) {
              console.warn(
                "⚠️ Duplicate player detected, skipping:",
                player.name,
                player.id
              );
              continue;
            }
            seenPlayerIds.add(player.id);
            players.push(player);
          } else {
            console.warn(
              "⚠️ Invalid player data (missing id or name):",
              player
            );
          }
        } catch (e) {
          console.warn("⚠️ Failed to parse player data:", e);
        }
      }
    }
    return players;
  }

  /**
   * Build and send a room update by fetching all Gun.js fields in parallel and parsing results.
   * Uses async/await for clarity and performance.
   * @returns {Promise<void>} Resolves after callback is called with the updated room
   */
  const buildRoomUpdate = async () => {
    const now = Date.now();
    if (now - lastUpdate < 300) return;
    lastUpdate = now;

    const [
      id,
      hostId,
      hostName,
      createdAt,
      maxPlayers,
      isLocked,
      playersData,
      matchesJson,
      commonMatchId,
      assignmentsJson,
      currentStep,
      gameStarted,
      playerDrinksJson,
    ] = await Promise.all([
      getRoomField(roomRef, "id"),
      getRoomField(roomRef, "hostId"),
      getRoomField(roomRef, "hostName"),
      getRoomField(roomRef, "createdAt"),
      getRoomField(roomRef, "maxPlayers"),
      getRoomField(roomRef, "isLocked"),
      getRoomField(roomRef, "players"),
      getRoomField(roomRef, "matches"),
      getRoomField(roomRef, "commonMatchId"),
      getRoomField(roomRef, "playerAssignments"),
      getRoomField(roomRef, "currentStep"),
      getRoomField(roomRef, "gameStarted"),
      getRoomField(roomRef, "playerDrinks"),
    ]);

    if (!id) return;

    const players = parsePlayers(playersData);

    const roomData: GunRoomData = {
      id,
      code: normalizedCode,
      hostId,
      hostName: hostName || "Host",
      createdAt: createdAt || Date.now(),
      maxPlayers: maxPlayers || 10,
      isLocked: isLocked || false,
      players: players.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
    };

    if (matchesJson) roomData.matches = matchesJson;
    if (commonMatchId)
      roomData.commonMatchId = commonMatchId === "" ? null : commonMatchId;
    if (assignmentsJson) roomData.playerAssignments = assignmentsJson;
    if (currentStep !== undefined && currentStep !== null)
      roomData.currentStep = currentStep;
    if (gameStarted) roomData.gameStarted = gameStarted;
    if (playerDrinksJson) roomData.playerDrinks = playerDrinksJson;

    localRoomCache.set(normalizedCode, roomData);

    const room: GameRoom = {
      id,
      code: normalizedCode,
      hostId,
      hostName: hostName || "Host",
      players,
      createdAt: createdAt || Date.now(),
      maxPlayers: maxPlayers || 10,
      isLocked: isLocked || false,
      matches: matchesJson,
      commonMatchId: commonMatchId === "" ? null : commonMatchId,
      playerAssignments: assignmentsJson,
      currentStep:
        currentStep !== undefined && currentStep !== null
          ? currentStep
          : undefined,
      gameStarted: gameStarted || undefined,
      playerDrinks: playerDrinksJson || undefined,
    };

    callback(room);
  };

  // Listen to room-level changes
  const roomListener = roomRef.on(buildRoomUpdate);
  listeners.push(roomListener);

  // ALSO listen specifically to player changes using .map()
  const playersListener = roomRef
    .get("players")
    .map()
    .on((playerData: any, playerId: string) => {
      // Rebuild room when any player changes (including removals)
      buildRoomUpdate();
    });
  listeners.push(playersListener);

  // Listen specifically to playerDrinks changes
  const playerDrinksListener = roomRef
    .get("playerDrinks")
    .on((playerDrinksData: any) => {
      // Rebuild room when player drinks change
      buildRoomUpdate();
    });
  listeners.push(playerDrinksListener);

  // Return cleanup function
  return () => {
    listeners.forEach((listener) => {
      if (listener && listener.off) listener.off();
    });
  };
};

/**
 * Update room lock status (host only).
 * @param {string} roomCode - Room code
 * @param {boolean} isLocked - Lock status
 */
export const lockRoom = (roomCode: string, isLocked: boolean): void => {
  const normalizedCode = roomCode.toUpperCase();
  const roomData = localRoomCache.get(normalizedCode);

  if (roomData) {
    roomData.isLocked = isLocked;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Kick a player from the room (host only).
 * @param {string} roomCode - Room code
 * @param {string} playerId - Player ID to kick
 */
export const kickPlayer = (roomCode: string, playerId: string): void => {
  const normalizedCode = roomCode.toUpperCase();
  const roomData = localRoomCache.get(normalizedCode);

  if (roomData && roomData.players[playerId]) {
    delete roomData.players[playerId];
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Sync matches to room (any player can update).
 * Accepts either a raw matches array or a precomputed envelope.
 * @param {string} roomCode - Room code
 * @param {Match[]|MatchesEnvelope} payload - Matches data or envelope
 */
export function syncMatchesToRoom(
  roomCode: string,
  payload: Match[] | MatchesEnvelope
): void {
  const normalizedCode = roomCode.toUpperCase();

  const envelope = ensureMatchesEnvelope(payload);
  const matchesJson = JSON.stringify(envelope);

  // Update Gun
  gun.get("rooms").get(normalizedCode).get("matches").put(matchesJson);

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.matches = matchesJson;
    localRoomCache.set(normalizedCode, roomData);
  }
}

/**
 * Sync common match ID to room (host only).
 * @param {string} roomCode - Room code
 * @param {string|null} commonMatchId - Common match ID or null
 */
export const syncCommonMatchToRoom = (
  roomCode: string,
  commonMatchId: string | null
): void => {
  const normalizedCode = roomCode.toUpperCase();

  // Update Gun (use empty string for null since Gun doesn't handle null well)
  gun
    .get("rooms")
    .get(normalizedCode)
    .get("commonMatchId")
    .put(commonMatchId || "");

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.commonMatchId = commonMatchId;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Sync player assignments to room using an AssignmentEnvelope (any player can update).
 * @param {string} roomCode - Room code
 * @param {AssignmentEnvelope} envelope - Assignment envelope
 */
export const syncAssignmentsToRoom = (
  roomCode: string,
  envelope: AssignmentEnvelope
): void => {
  const normalizedCode = roomCode.toUpperCase();

  const assignmentsJson = JSON.stringify(envelope);

  // Update Gun
  gun
    .get("rooms")
    .get(normalizedCode)
    .get("playerAssignments")
    .put(assignmentsJson);

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.playerAssignments = assignmentsJson;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Sync current wizard step to room (host only).
 * @param {string} roomCode - Room code
 * @param {number} currentStep - Current step number
 */
export const syncCurrentStepToRoom = (
  roomCode: string,
  currentStep: number
): void => {
  const normalizedCode = roomCode.toUpperCase();

  // Update Gun
  gun.get("rooms").get(normalizedCode).get("currentStep").put(currentStep);

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.currentStep = currentStep;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Sync game started flag to room (host only).
 * Triggers navigation to gameProgress for all players.
 * @param {string} roomCode - Room code
 */
export const syncGameStartedToRoom = (roomCode: string): void => {
  const normalizedCode = roomCode.toUpperCase();

  // Update Gun
  gun.get("rooms").get(normalizedCode).get("gameStarted").put(true);

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.gameStarted = true;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Sync player drink counts to room during gameplay.
 * Accepts either a raw player drink map or a full envelope.
 * @param {string} roomCode - Room code
 * @param {{ [playerId: string]: number }|PlayerDrinksEnvelope} payload - Player drink counts or envelope
 */
export function syncPlayerDrinksToRoom(
  roomCode: string,
  payload: { [playerId: string]: number } | PlayerDrinksEnvelope
): void {
  const normalizedCode = roomCode.toUpperCase();

  const envelope = ensurePlayerDrinksEnvelope(payload);
  const playerDrinksJson = JSON.stringify(envelope);

  // Update Gun
  gun
    .get("rooms")
    .get(normalizedCode)
    .get("playerDrinks")
    .put(playerDrinksJson);

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.playerDrinks = playerDrinksJson;
    localRoomCache.set(normalizedCode, roomData);
  }
}

/**
 * Persist a canonical setup snapshot authored by the host.
 * Also updates legacy fields for downstream consumers.
 * @param {string} roomCode - Room code
 * @param {SetupSnapshotPayload} snapshot - Setup snapshot payload
 */
export const syncSetupSnapshotToRoom = (
  roomCode: string,
  snapshot: SetupSnapshotPayload
): void => {
  const normalizedCode = roomCode.toUpperCase();
  const serializedSnapshot = JSON.stringify(snapshot);

  const roomRef = gun.get("rooms").get(normalizedCode);
  roomRef.get("setupSnapshot").put(serializedSnapshot);

  // Keep legacy fields in sync for downstream consumers
  const snapshotMatchesEnvelope: MatchesEnvelope = {
    version: snapshot.version,
    authorId: snapshot.authorId,
    updatedAt: snapshot.updatedAt,
    matches: snapshot.matches,
  };
  syncMatchesToRoom(roomCode, snapshotMatchesEnvelope);
  syncCommonMatchToRoom(roomCode, snapshot.commonMatchId);
  syncAssignmentsToRoom(roomCode, {
    version: snapshot.version,
    authorId: snapshot.authorId,
    updatedAt: snapshot.updatedAt,
    assignments: snapshot.playerAssignments,
  });
  syncCurrentStepToRoom(roomCode, snapshot.currentStep);
  roomRef.get("matchesPerPlayer").put(snapshot.matchesPerPlayer);

  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.setupSnapshot = serializedSnapshot;
    roomData.matches = JSON.stringify(snapshotMatchesEnvelope);
    roomData.commonMatchId = snapshot.commonMatchId;
    roomData.playerAssignments = JSON.stringify({
      version: snapshot.version,
      authorId: snapshot.authorId,
      updatedAt: snapshot.updatedAt,
      assignments: snapshot.playerAssignments,
    });
    roomData.currentStep = snapshot.currentStep;
    roomData.matchesPerPlayer = snapshot.matchesPerPlayer;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Subscribe to host-authored setup snapshot updates.
 * Listens for changes to the setupSnapshot field in Gun.js and invokes the callback with the parsed snapshot.
 * @param {string} roomCode - Room code
 * @param {(snapshot: SetupSnapshotPayload|null) => void} callback - Callback for snapshot updates
 * @returns {() => void} Unsubscribe function
 */
export const subscribeToSetupSnapshot = (
  roomCode: string,
  callback: (snapshot: SetupSnapshotPayload | null) => void
): (() => void) => {
  const normalizedCode = roomCode.toUpperCase();
  const snapshotRef = gun.get("rooms").get(normalizedCode).get("setupSnapshot");

  const listener = snapshotRef.on((snapshotJson: any) => {
    if (!snapshotJson) {
      callback(null);
      return;
    }

    try {
      const parsed: SetupSnapshotPayload =
        typeof snapshotJson === "string"
          ? JSON.parse(snapshotJson)
          : snapshotJson;
      callback(parsed);
    } catch (error) {
      console.error("Failed to parse setup snapshot:", error);
    }
  });

  return () => {
    if (listener && typeof listener.off === "function") {
      listener.off();
    }
  };
};
