export type RoomState = "joinable" | "in_progress" | "completed" | "closed";

/** How a room's assignments get decided (FR-026). `player_picked` exists as a
 * value but is not yet actionable — #185 implements it. */
export type AssignmentMode = "automatic" | "host_assigned" | "player_picked";

export type RoomMembershipType = "registered" | "guest";

export type RoomSessionRole = "owner" | "member";

export interface RoomParticipantSummary {
  id: string;
  displayName: string;
  membershipType: RoomMembershipType;
  sessionRole: RoomSessionRole;
  currentDrinkTotal: number;
}

export interface RoomMatchSummary {
  id: string;
  sourceProvider: string;
  sourceMatchId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
  homeScore: number;
  awayScore: number;
}

export interface RoomAssignmentSummary {
  participantId: string;
  matchId: string;
}

/**
 * One participant's pre-start pick in player-picked mode (FR-038, FR-042).
 *
 * Distinct from `RoomAssignmentSummary` even though the shape matches: picks are
 * drafts held in `public.assignment_picks` and written by the participant
 * themselves, while assignments are the settled set the server authors at start.
 * The lobby derives every participant's progress from this array rather than
 * from a server-computed field (specs/022-player-picked-mode research.md R7).
 */
export interface RoomPickSummary {
  participantId: string;
  matchId: string;
}

/**
 * Server-computed feasibility read for the room's current roster, pool, and
 * assignment settings (FR-012, FR-033). Pure read — recomputed on every
 * snapshot poll, never mutated directly.
 */
export interface AssignmentPlan {
  participantCount: number;
  poolSize: number;
  matchesPerPlayer: number;
  sharedMatchesPerPair: number;
  effectivePerPlayer: number;
  requiredPoolSize: number;
  relaxedFloor: number;
  feasible: boolean;
  startable: boolean;
}

export interface RoomSnapshot {
  sessionId: string;
  joinCode: string;
  state: RoomState;
  commonMatchId: string | null;
  assignmentMode: AssignmentMode;
  participants: RoomParticipantSummary[];
  matches: RoomMatchSummary[];
  assignments: RoomAssignmentSummary[];
  /** Pre-start player-picked draft picks for every participant (FR-042). Empty
   * outside player-picked mode, and never the source of a started game's
   * assignments — see `assignments` for that. */
  picks: RoomPickSummary[];
  assignmentPlan: AssignmentPlan;
}

export interface RegisteredJoinResponse {
  participantId: string;
  sessionId: string;
  joinCode: string;
  displayName: string;
  membershipType: "registered";
  sessionRole: "member";
  snapshot: RoomSnapshot;
}

export type HostLeaveResponse =
  | {
      status: "transferred";
      sessionId: string;
      newHostParticipantId: string;
      newHostDisplayName: string;
      snapshot: RoomSnapshot;
    }
  | { status: "closed"; sessionId: string };

/**
 * `end_game_session` (migration 040). `closed` only comes back when the room was
 * already closed by a host leaving with no successor — ending a running game
 * always produces `completed`, the state a played game belongs in.
 */
export interface EndGameSessionResponse {
  status: "completed" | "closed";
  sessionId: string;
}

export interface MemberLeaveResponse {
  sessionId: string;
  status: "left";
}

export interface MyActiveRoom {
  sessionId: string;
  participantId: string;
  role: RoomSessionRole;
  joinCode: string | null;
}

/** Request shape for `add_room_match` (US1). */
/**
 * Outcome of a batched fixture add.
 *
 * `skipped` counts fixtures already present in the room's pool. A repeat is a
 * deliberate no-op rather than an error — the same contract the single-fixture
 * RPC has always had — so a caller that selected ten and sees `added: 8,
 * skipped: 2` has lost nothing.
 */
export interface BatchRoomMatchResult {
  added: number;
  skipped: number;
}

export interface AddRoomMatchRequest {
  sourceProvider: string;
  sourceMatchId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
}

/** One entry of the bulk `set_room_assignments` payload (US3). */
export interface RoomAssignmentInput {
  participantId: string;
  matchId: string;
}

/** Request shape for `set_room_assignment_settings` (US4, FR-028 to FR-031). */
export interface RoomAssignmentSettingsRequest {
  matchesPerPlayer: number;
  sharedMatchesPerPair: number;
}

/** Error codes raised by the room RPCs (PostgrestError.message). */
export const ROOM_ERROR = {
  notAuthenticated: "not_authenticated",
  roomNotFound: "room_not_found",
  roomNotJoinable: "room_not_joinable",
  alreadyInActiveRoom: "already_in_active_room",
  forbidden: "forbidden",
  notHost: "not_host",
  successorRequired: "successor_required",
  successorNotEligible: "successor_not_eligible",
  matchNotFound: "match_not_found",
  invalidAssignment: "invalid_assignment",
  invalidAssignmentSettings: "invalid_assignment_settings",
  perPlayerCountBelowMinimum: "per_player_count_below_minimum",
  insufficientMatchPool: "insufficient_match_pool",
  assignmentConstraintsUnsatisfiable: "assignment_constraints_unsatisfiable",
  invalidAssignmentMode: "invalid_assignment_mode",
  /** A pick submission exceeded the room's per-player count (FR-040). */
  pickLimitExceeded: "pick_limit_exceeded",
  /** Picking attempted in a room that isn't in player-picked mode (FR-038). */
  roomNotPlayerPicked: "room_not_player_picked",
  /** The caller isn't an active participant of the room (FR-038a). */
  notAParticipant: "not_a_participant",
} as const;

// NOTE: `start_game_session`'s RPC result (including `filledInParticipantIds`)
// is NOT modeled here. The Java command-api's `CommandResponse` deliberately
// does not forward handler/RPC internals to the client ("Handler internals
// never leak to clients" — command-api/.../CommandResult.java) — the same
// boundary `relaxedConstraints` already lives behind. The host learns who
// will be filled in from the pre-start lobby display (derived from
// `assignmentPlan` + `assignments`, same as the "still short" indicator),
// not from the start-game response. See research.md R5.
