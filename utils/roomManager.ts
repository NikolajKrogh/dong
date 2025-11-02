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
 * Join an existing room by code
 */
export const joinRoom = async (
  roomCode: string,
  playerId: string,
  playerName: string
): Promise<GameRoom | null> => {
  const normalizedCode = roomCode.toUpperCase();

  return new Promise((resolve) => {
    let resolved = false;
    const roomRef = gun.get("rooms").get(normalizedCode);

    // Try to join with room data
    roomRef.get("id").once((id: any) => {
      if (resolved) return;

      roomRef.get("hostId").once((hostId: any) => {
        if (resolved) return;
        roomRef.get("hostId").once((hostId: any) => {
          roomRef.get("hostName").once((hostName: any) => {
            roomRef.get("createdAt").once((createdAt: any) => {
              roomRef.get("maxPlayers").once((maxPlayers: any) => {
                roomRef.get("isLocked").once((isLocked: any) => {
                  if (!id || !hostId) {
                    // Not enough data yet
                    return;
                  }

                  // Check if room is locked
                  if (isLocked) {
                    console.error("❌ Room is locked");
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

          resolved = true;
          resolve(room);
        }
      }
    }, 100);

    // Timeout - reduced from 10s to 3s for better UX
    const timeoutMs = isTestEnv ? 1000 : 3000; // 1s for tests, 3s for production
    setTimeout(() => {
      if (!resolved) {
        if (!isTestEnv) {
          console.error("❌ Timeout: Room not found after 3s");
        }
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
 * Subscribe to room updates via Gun P2P
 */
export const subscribeToRoom = (
  roomCode: string,
  callback: (room: GameRoom | null) => void
): (() => void) => {
  const normalizedCode = roomCode.toUpperCase();
  const roomRef = gun.get("rooms").get(normalizedCode);
  let lastUpdate = 0;
  const listeners: any[] = [];

  // Helper to build and send room update
  const buildRoomUpdate = () => {
    const now = Date.now();
    if (now - lastUpdate < 300) return; // Reduced debounce for faster updates
    lastUpdate = now;

    roomRef.get("id").once((id: any) => {
      if (!id) return;

      roomRef.get("hostId").once((hostId: any) => {
        roomRef.get("hostName").once((hostName: any) => {
          roomRef.get("createdAt").once((createdAt: any) => {
            roomRef.get("maxPlayers").once((maxPlayers: any) => {
              roomRef.get("isLocked").once((isLocked: any) => {
                roomRef.get("players").once((playersData: any) => {
                  const players: RoomPlayer[] = [];
                  const seenPlayerIds = new Set<string>();

                  if (playersData) {
                    for (const pId in playersData) {
                      if (pId === "_") continue;

                      const playerData = playersData[pId];

                      // Skip null/undefined (happens when player leaves)
                      if (playerData === null || playerData === undefined) {
                        continue;
                      }

                      if (playerData) {
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

                  roomRef.get("matches").once((matchesJson: any) => {
                    roomRef.get("commonMatchId").once((commonMatchId: any) => {
                      roomRef
                        .get("playerAssignments")
                        .once((assignmentsJson: any) => {
                          roomRef
                            .get("currentStep")
                            .once((currentStep: any) => {
                              roomRef
                                .get("gameStarted")
                                .once((gameStarted: any) => {
                                  roomRef
                                    .get("playerDrinks")
                                    .once((playerDrinksJson: any) => {
                                      if (matchesJson) {
                                        roomData.matches = matchesJson;
                                      }
                                      if (commonMatchId) {
                                        roomData.commonMatchId =
                                          commonMatchId === ""
                                            ? null
                                            : commonMatchId;
                                      }
                                      if (assignmentsJson) {
                                        roomData.playerAssignments =
                                          assignmentsJson;
                                      }
                                      if (
                                        currentStep !== undefined &&
                                        currentStep !== null
                                      ) {
                                        roomData.currentStep = currentStep;
                                      }
                                      if (gameStarted) {
                                        roomData.gameStarted = gameStarted;
                                      }
                                      if (playerDrinksJson) {
                                        roomData.playerDrinks =
                                          playerDrinksJson;
                                      }

                                      localRoomCache.set(
                                        normalizedCode,
                                        roomData
                                      );

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
                                        commonMatchId:
                                          commonMatchId === ""
                                            ? null
                                            : commonMatchId,
                                        playerAssignments: assignmentsJson,
                                        currentStep:
                                          currentStep !== undefined &&
                                          currentStep !== null
                                            ? currentStep
                                            : undefined,
                                        gameStarted: gameStarted || undefined,
                                        playerDrinks:
                                          playerDrinksJson || undefined,
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
            });
          });
        });
      });
    });
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
 * Update room lock status (host only)
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
 * Kick player from room (host only)
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
 * Sync matches to room (any player can update)
 */
export const syncMatchesToRoom = (roomCode: string, matches: any[]): void => {
  const normalizedCode = roomCode.toUpperCase();

  const matchesJson = JSON.stringify(matches);

  // Update Gun
  gun.get("rooms").get(normalizedCode).get("matches").put(matchesJson);

  // Update local cache
  const roomData = localRoomCache.get(normalizedCode);
  if (roomData) {
    roomData.matches = matchesJson;
    localRoomCache.set(normalizedCode, roomData);
  }
};

/**
 * Sync common match ID to room (host only)
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
 * Sync player assignments to room (any player can update)
 */
export const syncAssignmentsToRoom = (
  roomCode: string,
  assignments: { [playerId: string]: string[] }
): void => {
  const normalizedCode = roomCode.toUpperCase();

  const assignmentsJson = JSON.stringify(assignments);

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
 * Sync current wizard step to room (host only)
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
 * Sync game started flag to room (host only)
 * This triggers navigation to gameProgress for all players
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
 * Sync player drink counts to room during gameplay
 * All players can update their own drink counts
 */
export const syncPlayerDrinksToRoom = (
  roomCode: string,
  playerDrinks: { [playerId: string]: number }
): void => {
  const normalizedCode = roomCode.toUpperCase();

  const playerDrinksJson = JSON.stringify(playerDrinks);

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
};
