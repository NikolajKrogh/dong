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

export interface RoomSnapshot {
  sessionId: string;
  joinCode: string;
  state: RoomState;
  commonMatchId: string | null;
  participants: RoomParticipantSummary[];
  matches: RoomMatchSummary[];
  assignments: RoomAssignmentSummary[];
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
} as const;
