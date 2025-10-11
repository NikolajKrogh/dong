/**
 * Gun.js Room Types
 *
 * Type definitions for game room management with Gun.js
 */

/**
 * Room connection status
 */
export type RoomConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * Player in a room
 */
export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

/**
 * Room configuration and state
 */
export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  players: RoomPlayer[];
  createdAt: number;
  maxPlayers?: number;
  isLocked?: boolean;
}

/**
 * Room data stored in Gun
 */
export interface GunRoomData {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  createdAt: number;
  maxPlayers: number;
  isLocked: boolean;
  players: { [playerId: string]: RoomPlayer };
}
