// Client contract for the room lobby RPCs (authenticated host + registered members).
// Mirrors GuestRoomRpcClient in utils/supabaseClient.ts. Guests continue to use GuestRoomRpcClient.

import type {
  RoomSnapshot,
  RoomParticipantSummary,
} from "../../../types/room";

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
  role: "owner" | "member";
  joinCode: string | null; // present only when role === "owner"
}

export interface RoomRpcClient {
  // join_room_as_registered — may reject with `already_in_active_room`; caller runs easy-exit then retries.
  joinRoomAsRegistered(joinCode: string): Promise<RegisteredJoinResponse>;

  // get_room_snapshot
  getRoomSnapshot(sessionId: string): Promise<RoomSnapshot>;

  // get_my_active_room — null when the user is not in any active room (powers "Return to room").
  getMyActiveRoom(): Promise<MyActiveRoom | null>;

  // leave_room_as_member
  leaveRoomAsMember(sessionId: string): Promise<MemberLeaveResponse>;

  // leave_room_as_host — omit successor for auto/close; provide to resolve `successor_required`.
  // Implementations MUST surface `successor_required` (prompt + retry) and `successor_not_eligible`
  // (re-call with no successor so the server re-decides).
  leaveRoomAsHost(
    sessionId: string,
    successorParticipantId?: string,
  ): Promise<HostLeaveResponse>;
}

// Note: create_room_as_host (existing client method) may now also reject with `already_in_active_room`.
// Guest leave (leave_room_as_guest, token-scoped) lives on the existing GuestRoomRpcClient, not here.
// All lobby polling uses a single shared LOBBY_POLL_INTERVAL_MS = 4000.

// Eligible successors for the chooser are derived client-side from a fresh snapshot:
//   snapshot.participants.filter(p => p.membershipType === "registered" && p.sessionRole === "member")
export type EligibleSuccessor = RoomParticipantSummary;
