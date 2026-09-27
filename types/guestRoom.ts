import type { AssignmentMode, AssignmentPlan } from "./room";

export type GuestRoomSessionStatus =
  "idle" | "joining" | "joined" | "refreshing" | "failed" | "expired" | "pending_leave" | "renewing" | "left";

/**
 * The room states a guest can observe.
 *
 * These are `public.session_state` verbatim. The union previously read
 * `"joinable" | "in_play" | "completed"`, and `"in_play"` is not a value the
 * enum has ever contained — the server sends `in_progress`. Nothing caught it
 * because every mock and fixture agreed with the type rather than the database,
 * so a started room read as "some other state" everywhere it mattered. `closed`
 * was missing outright.
 */
export type GuestRoomSessionState =
  "joinable" | "in_progress" | "completed" | "closed";

export type GuestRoomMembershipType = "registered" | "guest";

export type GuestRoomParticipantRole = "owner" | "member";

export type GuestRoomErrorCode =
  | "room_not_found"
  | "room_not_joinable"
  | "guest_name_required"
  | "guest_token_expired"
  | "room_unavailable"
  | "rate_limited"
  | "protected_storage_unavailable"
  | "secure_random_unavailable"
  | "guest_access_lost"
  | "not_permitted"
  | "invalid_request"
  | "unknown_error";

export interface GuestRoomParticipantSummary {
  id: string;
  displayName: string;
  membershipType: GuestRoomMembershipType;
  sessionRole: GuestRoomParticipantRole;
  currentDrinkTotal: number;
}

export interface GuestRoomMatchSummary {
  id: string;
  sourceProvider: string | null;
  sourceMatchId: string | null;
  sourceLeagueCode?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface GuestRoomAssignmentSummary {
  participantId: string;
  matchId: string;
}

/** One participant's pre-start pick in player-picked mode (FR-038, FR-042). */
export interface GuestRoomPickSummary {
  participantId: string;
  matchId: string;
}

/**
 * A guest's view of the room.
 *
 * `assignmentMode` and `assignmentPlan` are **not new on the wire** — guests
 * have received both for some time, because `private.get_guest_room_snapshot`
 * and `private.get_room_snapshot` delegate to the same
 * `private.build_guest_room_snapshot` builder, which gained `assignmentPlan` in
 * migration 036 (#135) and `assignmentMode` in 037 (#184). This type simply
 * never declared them. Both are declared now because the guest pick UI needs
 * the mode (to decide whether to render at all) and the plan's
 * `matchesPerPlayer` (the pick cap) — see
 * specs/022-player-picked-mode/research.md R11.
 *
 * The types are imported from `./room` rather than redeclared: one server
 * function produces both snapshots, so divergence here would be a bug, not a
 * variation.
 */
export interface GuestRoomSnapshot {
  sessionId: string;
  joinCode: string;
  state: GuestRoomSessionState;
  ownerParticipantId?: string | null;
  lastEventSequence?: number;
  commonMatchId: string | null;
  assignmentMode: AssignmentMode;
  /** Live roster projection; absent on servers predating the roster migration. */
  activeRoster?: GuestRoomParticipantSummary[];
  participants: GuestRoomParticipantSummary[];
  matches: GuestRoomMatchSummary[];
  assignments: GuestRoomAssignmentSummary[];
  picks: GuestRoomPickSummary[];
  assignmentPlan: AssignmentPlan;
  grantExpiresAt?: string;
  finalOnly?: boolean;
}

export interface GuestRoomJoinRequest {
  joinCode: string;
  guestName: string;
  guestToken: string;
}

export interface GuestRoomSessionGrant {
  guestToken: string;
  participantId: string;
  sessionId: string;
  joinCode: string;
  displayName: string;
  grantExpiresAt?: string;
}

export interface GuestRoomJoinResponse {
  participantId: string;
  sessionId: string;
  guestToken: string;
  joinCode: string;
  displayName: string;
  grantExpiresAt?: string;
  snapshot: GuestRoomSnapshot;
}

export interface GuestRoomSession {
  grant: GuestRoomSessionGrant;
  snapshot: GuestRoomSnapshot;
}

export type GuestRoomLeaveResponse =
  | { ok: true; status: "confirmed" | "already_invalid" }
  | { ok: false; code: "not_permitted" | "rate_limited" };

export type GuestRoomRotationResponse =
  | { ok: true; participantId: string; grantExpiresAt: string; replayed: boolean }
  | { ok: false; code: "guest_access_lost" | "room_unavailable" | "rate_limited" | "invalid_request" };

export interface GuestRoomRotationRequest {
  oldToken: string;
  newToken: string;
  operationId: string;
}

export interface GuestRoomRpcError {
  code: GuestRoomErrorCode;
  message: string;
}
