export type GuestRoomSessionStatus =
  | "idle"
  | "joining"
  | "joined"
  | "refreshing"
  | "failed"
  | "expired";

export type GuestRoomSessionState = "joinable" | "in_play" | "completed";

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

export interface GuestRoomSnapshot {
  sessionId: string;
  joinCode: string;
  state: GuestRoomSessionState;
  commonMatchId: string | null;
  participants: GuestRoomParticipantSummary[];
  matches: GuestRoomMatchSummary[];
  assignments: GuestRoomAssignmentSummary[];
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
