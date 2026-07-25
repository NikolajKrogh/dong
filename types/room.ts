export type RoomState = "joinable" | "in_progress" | "completed" | "closed";

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
  participants: RoomParticipantSummary[];
  matches: RoomMatchSummary[];
  assignments: RoomAssignmentSummary[];
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
} as const;
