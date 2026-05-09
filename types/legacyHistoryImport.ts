import type { Match, Player } from "../store/store";

/**
 * Legacy import lifecycle for a signed-in account.
 * @description Mirrors the account-level import-state enum stored in the private ledger.
 */
export type LegacyHistoryImportState = "in_progress" | "completed" | "failed";

/**
 * Per-session import lifecycle.
 * @description Mirrors the per-session status stored in the private import ledger.
 */
export type LegacyHistoryImportSessionState =
  | "pending"
  | "imported"
  | "skipped"
  | "failed"
  | "conflict";

/**
 * Mapping of local player identifiers to the local match identifiers they were assigned.
 * @description Used by the importer to preserve the original assignment graph in the RPC payload.
 */
export type LegacyHistoryPlayerAssignments = Record<string, string[]>;

/**
 * Persisted local game session snapshot.
 * @description Matches the AsyncStorage history shape written by the Zustand store.
 */
export interface LegacyLocalSessionSnapshot {
  id: string;
  date: string;
  players: Player[];
  matches: Match[];
  commonMatchId: string | null;
  playerAssignments: LegacyHistoryPlayerAssignments;
  matchesPerPlayer: number;
}

/**
 * Claimant option exposed in the Settings flow.
 * @description Represents one local participant that the signed-in user can claim as their account.
 */
export interface LegacyHistoryClaimantOption {
  id: string;
  name: string;
  sessionIds: string[];
  sessionCount: number;
}

/**
 * Player snapshot sent to the RPC.
 * @description Preserves the original local participant identity and drink totals.
 */
export interface LegacyHistoryImportPlayerPayload {
  id: string;
  name: string;
  drinksTaken?: number;
}

/**
 * Guest participant snapshot sent alongside a session payload.
 * @description Preserves session-scoped local players without promoting them into durable accounts.
 */
export type LegacyHistoryImportGuestParticipantPayload =
  LegacyHistoryImportPlayerPayload;

/**
 * Match snapshot sent to the RPC.
 * @description Preserves the original match identity, scoreline, and optional kickoff timestamp.
 */
export interface LegacyHistoryImportMatchPayload {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  startTime?: string;
}

/**
 * Deterministic session fields used by the server-side source fingerprint.
 * @description Excludes claimant identity so retries and wrong claimant choices do not change dedupe semantics.
 */
export interface LegacyHistorySourceFingerprintInput {
  sourceLocalSessionId: string;
  savedAt: string;
  commonMatchId: string | null;
  matchesPerPlayer: number;
  players: LegacyHistoryImportPlayerPayload[];
  matches: LegacyHistoryImportMatchPayload[];
  playerAssignments: LegacyHistoryPlayerAssignments;
}

/**
 * Normalized legacy session payload.
 * @description The client sends this shape to the RPC instead of raw AsyncStorage internals.
 */
export interface LegacyHistoryImportSessionPayload extends LegacyHistorySourceFingerprintInput {
  claimedLocalParticipantId: string;
  guestParticipants: LegacyHistoryImportGuestParticipantPayload[];
}

/**
 * RPC request body for the one-time importer.
 * @description Sends one claimant choice plus the normalized local sessions eligible for import.
 */
export interface ImportLegacyHistoryRpcRequest {
  claimedLocalParticipantId: string;
  sessions: LegacyHistoryImportSessionPayload[];
}

/**
 * Aggregate import counts returned by the RPC.
 * @description Allows the client to render batch status without recomputing per-session results.
 */
export interface LegacyHistoryImportSummary {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
}

/**
 * Per-session result returned by the RPC.
 * @description Captures the server fingerprint, final status, and optional created cloud session id.
 */
export interface LegacyHistoryImportSessionResult {
  sourceLocalSessionId: string;
  sourceFingerprint: string;
  state: LegacyHistoryImportSessionState;
  cloudSessionId?: string;
  errorMessage?: string;
}

/**
 * RPC response for the one-time importer.
 * @description Returns the account-level state plus the detailed per-session outcomes.
 */
export interface ImportLegacyHistoryRpcResponse {
  accountId: string;
  importState: LegacyHistoryImportState;
  claimedLocalParticipantId: string;
  summary: LegacyHistoryImportSummary;
  sessions: LegacyHistoryImportSessionResult[];
}
