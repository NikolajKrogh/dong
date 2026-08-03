import type { AssignmentMode, AssignmentPlan } from "./room";

export type GuestRoomSessionStatus =
  "idle" | "joining" | "joined" | "refreshing" | "failed" | "expired";

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
  commonMatchId: string | null;
  assignmentMode: AssignmentMode;
  participants: GuestRoomParticipantSummary[];
  matches: GuestRoomMatchSummary[];
  assignments: GuestRoomAssignmentSummary[];
  picks: GuestRoomPickSummary[];
  assignmentPlan: AssignmentPlan;
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
}

export interface GuestRoomJoinResponse {
  participantId: string;
  sessionId: string;
  guestToken: string;
  joinCode: string;
  displayName: string;
  snapshot: GuestRoomSnapshot;
}

export interface GuestRoomSession {
  grant: GuestRoomSessionGrant;
  snapshot: GuestRoomSnapshot;
}

export interface GuestRoomRpcError {
  code: GuestRoomErrorCode;
  message: string;
}
