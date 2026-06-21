export interface HostRoomCreateResponse {
  sessionId: string;
  joinCode: string;
  hostParticipantId: string;
  hostDisplayName: string;
}

export type HostRoomCreateStatus = "idle" | "creating" | "success" | "error";
