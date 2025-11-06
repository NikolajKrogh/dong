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
  // Game state syncing
  matches?: string; // JSON stringified MatchesEnvelope
  commonMatchId?: string | null;
  playerAssignments?: string; // JSON stringified { [playerId: string]: string[] }
  currentStep?: number; // Current wizard step (0-3) - controlled by host
  gameStarted?: boolean; // Flag to indicate game has started - triggers navigation to gameProgress
  playerDrinks?: string; // JSON stringified PlayerDrinksEnvelope - drinks consumed during game
  matchesPerPlayer?: number;
  setupSnapshot?: string; // JSON stringified setup snapshot managed by the host
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
  // Game state syncing
  matches?: string; // JSON stringified MatchesEnvelope
  commonMatchId?: string | null;
  playerAssignments?: string; // JSON stringified { [playerId: string]: string[] }
  currentStep?: number; // Current wizard step (0-3) - controlled by host
  gameStarted?: boolean; // Flag to indicate game has started - triggers navigation to gameProgress
  playerDrinks?: string; // JSON stringified PlayerDrinksEnvelope - drinks consumed during game
  matchesPerPlayer?: number;
  setupSnapshot?: string; // JSON stringified setup snapshot managed by the host
}
