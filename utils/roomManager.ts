/**
 * Gun.js Room Management Utilities
 *
 * Handles creation, joining, and management of game rooms using Gun.js
 * Uses hybrid approach: Gun for P2P sync + local cache for instant access
 */

import gun from "./gunConfig";
import { GameRoom, GunRoomData, RoomPlayer } from "../types/room";

// Detect test environment
const isTestEnv =
  typeof jest !== "undefined" || process.env.NODE_ENV === "test";

// Local cache for instant access while Gun syncs in background
const localRoomCache = new Map<string, GunRoomData>();

if (!isTestEnv) {
  console.log("🎮 Room manager initialized with Gun P2P + local cache");
}

/**
 * Generate a random 6-character room code
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
 * Generate a unique room ID
 */
export const generateRoomId = (): string => {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new game room
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

  console.log("🎲 Creating room with code:", roomCode);
  console.log("📦 Room data to store:", roomData);

  // Store in local cache for instant access
  localRoomCache.set(roomCode, roomData);
  console.log("✅ Room cached locally");

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

    console.log("📡 Room data sent to Gun peers");

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

      console.log("✅ Room created and syncing via Gun");
      resolve(room);
    }, 100);
  });
};

/**
 * Join an existing room by code
 */
export const joinRoom = async (
  roomCode: string,
  playerId: string,
  playerName: string
): Promise<GameRoom | null> => {
  const normalizedCode = roomCode.toUpperCase();
  console.log("🚪 Attempting to join room:", normalizedCode);

  return new Promise((resolve) => {
    let resolved = false;
    const roomRef = gun.get("rooms").get(normalizedCode);

    // Listen for room data from Gun
    const listener = roomRef.on((data: any, key: string) => {
      if (resolved) return;

      // Gun sends individual field updates, we need to collect them
      console.log("📥 Received Gun data update:", key, data);

      // Check if we have enough data to join
      roomRef.get("id").once((id: any) => {
        roomRef.get("hostId").once((hostId: any) => {
          roomRef.get("hostName").once((hostName: any) => {
            roomRef.get("createdAt").once((createdAt: any) => {
              roomRef.get("maxPlayers").once((maxPlayers: any) => {
                roomRef.get("isLocked").once((isLocked: any) => {
                  if (!id || !hostId) {
                    // Not enough data yet
                    return;
                  }

                  console.log("✅ Got room data from Gun!");

                  // Check if room is locked
                  if (isLocked) {
                    console.error("❌ Room is locked");
                    if (listener) listener.off();
                    resolved = true;
                    resolve(null);
                    return;
                  }

                  // Get existing players
                  roomRef.get("players").once((playersData: any) => {
                    const players: RoomPlayer[] = [];

                    // Parse existing players
                    if (playersData) {
                      for (const pId in playersData) {
                        if (
                          playersData[pId] &&
                          typeof playersData[pId] === "string"
                        ) {
                          try {
                            const player = JSON.parse(playersData[pId]);
                            players.push(player);
                          } catch (e) {
                            // Skip invalid player data
                          }
                        }
                      }
                    }

                    // Check if room is full
                    if (players.length >= (maxPlayers || 10)) {
                      console.error("❌ Room is full");
                      if (listener) listener.off();
                      resolved = true;
                      resolve(null);
                      return;
                    }

                    // Add new player
                    const newPlayer: RoomPlayer = {
                      id: playerId,
                      name: playerName,
                      isHost: false,
                      joinedAt: Date.now(),
                    };

                    // Store player in Gun
                    roomRef
                      .get("players")
                      .get(playerId)
                      .put(JSON.stringify(newPlayer));

                    players.push(newPlayer);

                    // Create room object
                    const roomData: GunRoomData = {
                      id,
                      code: normalizedCode,
                      hostId,
                      hostName: hostName || "Host",
                      createdAt: createdAt || Date.now(),
                      maxPlayers: maxPlayers || 10,
                      isLocked: isLocked || false,
                      players: players.reduce(
                        (acc, p) => ({ ...acc, [p.id]: p }),
                        {}
                      ),
                    };

                    // Cache locally
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

                    console.log("✅ Successfully joined room:", room.code);
                    if (listener) listener.off();
                    resolved = true;
                    resolve(room);
                  });
                });
              });
            });
          });
        });
      });
    });

    // Also check local cache for instant join (if room was just created on this device)
    setTimeout(() => {
      if (!resolved) {
        const cachedRoom = localRoomCache.get(normalizedCode);
        if (cachedRoom) {
          console.log("✅ Found room in local cache (same device)");

          // Add player to cached room
          const newPlayer: RoomPlayer = {
            id: playerId,
            name: playerName,
            isHost: false,
            joinedAt: Date.now(),
          };

          cachedRoom.players[playerId] = newPlayer;
          localRoomCache.set(normalizedCode, cachedRoom);

          // Also update Gun
          roomRef.get("players").get(playerId).put(JSON.stringify(newPlayer));

          const room: GameRoom = {
            id: cachedRoom.id,
            code: normalizedCode,
            hostId: cachedRoom.hostId,
            hostName: cachedRoom.hostName,
            players: Object.values(cachedRoom.players),
            createdAt: cachedRoom.createdAt,
            maxPlayers: cachedRoom.maxPlayers,
            isLocked: cachedRoom.isLocked,
          };

          if (listener) listener.off();
          resolved = true;
          resolve(room);
        }
      }
    }, 100);

    // Timeout - shorter in test environment
    const timeoutMs = isTestEnv ? 1000 : 10000; // 1s for tests, 10s for production
    setTimeout(() => {
      if (!resolved) {
        if (!isTestEnv) {
          console.error("❌ Timeout: Room not found after 10s");
          console.log(
            "💡 Make sure the host created the room and both devices are connected to internet"
          );
        }
        if (listener) listener.off();
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);
  });
};

/**
 * Leave a room
 */
export const leaveRoom = (roomCode: string, playerId: string): void => {
  const normalizedCode = roomCode.toUpperCase();
  const roomData = localRoomCache.get(normalizedCode);

  if (roomData && roomData.players[playerId]) {
    delete roomData.players[playerId];
    localRoomCache.set(normalizedCode, roomData);
    console.log("✅ Player left room:", normalizedCode);
  }

  // Also try Gun (best effort)
  try {
    gun.get(`room:${normalizedCode}`).put({ data: JSON.stringify(roomData) });
  } catch (error) {
    // Ignore
  }
};

/**
 * Subscribe to room updates via Gun P2P
 */
export const subscribeToRoom = (
  roomCode: string,
  callback: (room: GameRoom | null) => void
): (() => void) => {
  const normalizedCode = roomCode.toUpperCase();
  const roomRef = gun.get("rooms").get(normalizedCode);
  let lastUpdate = 0;

  console.log("👂 Subscribing to room updates:", normalizedCode);

  // Listen to Gun updates
  const listener = roomRef.on(() => {
    // Debounce updates (Gun can fire rapidly)
    const now = Date.now();
    if (now - lastUpdate < 500) return;
    lastUpdate = now;

    console.log("📡 Room update detected from Gun");

    // Fetch latest room data
    roomRef.get("id").once((id: any) => {
      if (!id) return;

      roomRef.get("hostId").once((hostId: any) => {
        roomRef.get("hostName").once((hostName: any) => {
          roomRef.get("createdAt").once((createdAt: any) => {
            roomRef.get("maxPlayers").once((maxPlayers: any) => {
              roomRef.get("isLocked").once((isLocked: any) => {
                roomRef.get("players").once((playersData: any) => {
                  const players: RoomPlayer[] = [];

                  if (playersData) {
                    for (const pId in playersData) {
                      // Skip Gun's metadata (stored in '_' key)
                      if (pId === "_") continue;

                      const playerData = playersData[pId];
                      if (playerData) {
                        try {
                          // Handle both object and string formats
                          const player =
                            typeof playerData === "string"
                              ? JSON.parse(playerData)
                              : playerData;

                          // Validate it's a proper RoomPlayer object
                          if (player && player.id && player.name) {
                            players.push(player);
                          } else {
                            console.warn(
                              "⚠️ Invalid player data (missing id or name):",
                              player
                            );
                          }
                        } catch (e) {
                          // Skip invalid player data
                          console.warn("⚠️ Failed to parse player data:", e);
                        }
                      }
                    }
                  }

                  const roomData: GunRoomData = {
                    id,
                    code: normalizedCode,
                    hostId,
                    hostName: hostName || "Host",
                    createdAt: createdAt || Date.now(),
                    maxPlayers: maxPlayers || 10,
                    isLocked: isLocked || false,
                    players: players.reduce(
                      (acc, p) => ({ ...acc, [p.id]: p }),
                      {}
                    ),
                  };

                  // Update local cache
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

                  callback(room);
                });
              });
            });
          });
        });
      });
    });
  });

  // Return cleanup function
  return () => {
    console.log("🔇 Unsubscribing from room updates");
    if (listener) listener.off();
  };
};

/**
 * Update room lock status (host only)
 */
export const lockRoom = (roomCode: string, isLocked: boolean): void => {
  const normalizedCode = roomCode.toUpperCase();
  const roomData = localRoomCache.get(normalizedCode);

  if (roomData) {
    roomData.isLocked = isLocked;
    localRoomCache.set(normalizedCode, roomData);
    console.log(`✅ Room ${isLocked ? "locked" : "unlocked"}:`, normalizedCode);
  }
};

/**
 * Kick player from room (host only)
 */
export const kickPlayer = (roomCode: string, playerId: string): void => {
  const normalizedCode = roomCode.toUpperCase();
  const roomData = localRoomCache.get(normalizedCode);

  if (roomData && roomData.players[playerId]) {
    delete roomData.players[playerId];
    localRoomCache.set(normalizedCode, roomData);
    console.log("✅ Player kicked from room:", playerId);
  }
};
