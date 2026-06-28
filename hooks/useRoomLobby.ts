import { useCallback, useEffect, useRef, useState } from "react";

import type {
  RoomParticipantSummary,
  RoomSessionRole,
  RoomSnapshot,
  RoomState,
} from "../types/room";
import {
  getRoomRpcClient,
  LOBBY_POLL_INTERVAL_MS,
} from "../utils/supabaseClient";

export interface UseRoomLobbyResult {
  snapshot: RoomSnapshot | null;
  participants: RoomParticipantSummary[];
  myRole: RoomSessionRole | null;
  state: RoomState | null;
  /** Visible to the host only (per FR-0A7). */
  joinCode: string | null;
  /** True when the room closed/expired, or the viewer is no longer a participant. */
  roomEnded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Polls the durable room snapshot (no realtime) for the host/registered-member lobby.
 * Role is resolved by matching `myParticipantId` in the roster, so it updates live
 * across a host handover.
 */
export const useRoomLobby = (
  sessionId: string | null,
  myParticipantId: string | null,
): UseRoomLobbyResult => {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomEnded, setRoomEnded] = useState(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionId || inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      const next = await getRoomRpcClient().getRoomSnapshot(sessionId);
      setSnapshot(next);
      setError(null);

      const stillPresent =
        myParticipantId === null ||
        next.participants.some((p) => p.id === myParticipantId);
      setRoomEnded(next.state === "closed" || !stillPresent);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh the room right now.",
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [sessionId, myParticipantId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, LOBBY_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [sessionId, refresh]);

  const participants = snapshot?.participants ?? [];
  const me = myParticipantId
    ? (participants.find((p) => p.id === myParticipantId) ?? null)
    : null;
  const myRole = me?.sessionRole ?? null;
  const joinCode = myRole === "owner" ? (snapshot?.joinCode ?? null) : null;

  return {
    snapshot,
    participants,
    myRole,
    state: snapshot?.state ?? null,
    joinCode,
    roomEnded,
    error,
    refresh,
  };
};
