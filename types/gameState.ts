/**
 * Game State Synchronization Types
 * 
 * Type definitions for syncing game state between peers using Gun.js
 */

import { Player, Match } from '../store/store';

/**
 * Complete game state that gets synced between peers
 */
export interface SyncedGameState {
  /** Version for migration/compatibility */
  version: number;
  /** Last update timestamp */
  lastUpdated: number;
  /** Players in the game */
  players: Player[];
  /** Matches in the game */
  matches: Match[];
  /** Common match ID (if selected) */
  commonMatchId: string | null;
  /** Player assignments to matches */
  playerAssignments: { [playerId: string]: string[] };
  /** Matches per player configuration */
  matchesPerPlayer: number;
  /** Current game phase */
  phase: GamePhase;
}

/**
 * Game phase tracking
 */
export type GamePhase = 
  | 'setup'           // Setting up players and configuration
  | 'match-selection' // Selecting matches
  | 'in-progress'     // Game is active
  | 'finished';       // Game completed

/**
 * Game state update event
 */
export interface GameStateUpdate {
  type: GameStateUpdateType;
  timestamp: number;
  playerId: string;
  data: any;
}

/**
 * Types of game state updates
 */
export type GameStateUpdateType =
  | 'player-added'
  | 'player-removed'
  | 'player-drink'
  | 'match-added'
  | 'match-removed'
  | 'match-goal'
  | 'common-match-set'
  | 'assignments-updated'
  | 'phase-changed'
  | 'game-reset';

/**
 * Gun database structure for game state
 */
export interface GunGameState {
  roomCode: string;
  state: string; // JSON serialized SyncedGameState
  updates: { [updateId: string]: string }; // JSON serialized GameStateUpdate
}

/**
 * Sync status for UI feedback
 */
export type SyncStatus = 'synced' | 'syncing' | 'error' | 'disconnected';
