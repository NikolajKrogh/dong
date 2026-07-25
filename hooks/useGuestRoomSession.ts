import { useCallback, useEffect, useRef, useState } from "react";

import type {
  GuestRoomSession,
  GuestRoomSessionGrant,
  GuestRoomSessionStatus,
} from "../types/guestRoom";
import {
  buildGuestRoomSessionGrant,
  clearGuestRoomSessionGrant,
  createGuestRoomToken,
  getGuestRoomErrorMessage,
  isExpiredGuestRoomError,
  normalizeGuestRoomDisplayName,
  normalizeGuestRoomJoinCode,
  readGuestRoomSessionGrant,
  saveGuestRoomSessionGrant,
} from "../utils/guestRoom";
import { getGuestRoomRpcClient } from "../utils/supabaseClient";

export interface UseGuestRoomSessionResult {
  status: GuestRoomSessionStatus;
  session: GuestRoomSession | null;
  error: string | null;
  /**
   * True while a guest-initiated mutation (currently only `setMyPicks`) is in
   * flight, staying true until the follow-up snapshot refresh completes. Callers
   * must gate their controls on it: picks are submitted replace-all, so a second
   * tap that derived its array from the pre-refresh snapshot would clobber the
   * first. `useRoomConfigure`'s `run()` wrapper provides the same guarantee on
   * the registered path.
   */
  isBusy: boolean;
  joinRoom: (
    joinCode: string,
    guestName: string,
  ) => Promise<GuestRoomSession | null>;
  refreshRoom: () => Promise<GuestRoomSession | null>;
  leaveRoom: () => Promise<void>;
  replaceSession: (nextSession: GuestRoomSession | null) => Promise<void>;
  /**
   * Replaces this guest's **own** player-picked selections (FR-038, FR-038a).
   * The room-scoped token both authenticates the guest and identifies which
   * participant and room the picks belong to, so — as on the registered path —
   * there is no participant id to pass and no way to write anyone else's picks.
   * Replace-all: pass the complete next set (FR-040).
   */
  setMyPicks: (matchIds: string[]) => Promise<void>;
}

export const GUEST_ROOM_POLL_INTERVAL_MS = 1000;

const buildSessionFromGrant = async (grant: GuestRoomSessionGrant) => {
  const snapshot = await getGuestRoomRpcClient().getGuestRoomSnapshot(
    grant.guestToken,
  );

  return {
    grant,
    snapshot,
  } satisfies GuestRoomSession;
};

export const useGuestRoomSession = (): UseGuestRoomSessionResult => {
  const [status, setStatus] = useState<GuestRoomSessionStatus>("idle");
  const [session, setSession] = useState<GuestRoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingGuestToken, setPendingGuestToken] = useState<string | null>(
    null,
  );
  const sessionRef = useRef<GuestRoomSession | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshInFlightRef = useRef(false);
  const activeGrant = session?.grant ?? null;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    const restorePersistedSession = async () => {
      const persistedGrant = await readGuestRoomSessionGrant();

      if (!persistedGrant || !isMounted) {
        return;
      }

      setStatus("refreshing");

      try {
        const restoredSession = await buildSessionFromGrant(persistedGrant);

        if (!isMounted) {
          return;
        }

        setSession(restoredSession);
        setStatus("joined");
        setError(null);
      } catch (restoreError) {
        const hasExpiredGrant = isExpiredGuestRoomError(restoreError);

        if (hasExpiredGrant) {
          await clearGuestRoomSessionGrant();
        }

        if (!isMounted) {
          return;
        }

        setSession(null);
        setStatus(hasExpiredGrant ? "expired" : "failed");
        setError(
          getGuestRoomErrorMessage(
            restoreError,
            "Unable to restore the room right now.",
          ),
        );
      }
    };

    void restorePersistedSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const replaceSession = useCallback(
    async (nextSession: GuestRoomSession | null) => {
      if (!nextSession) {
        await clearGuestRoomSessionGrant();
        setSession(null);
        setStatus("idle");
        setError(null);
        setPendingGuestToken(null);
        return;
      }

      await saveGuestRoomSessionGrant(nextSession.grant);
      setSession(nextSession);
      setStatus("joined");
      setError(null);
      setPendingGuestToken(null);
    },
    [],
  );

  const refreshRoom = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (!currentSession?.grant) {
      return null;
    }

    setStatus("refreshing");

    try {
      const refreshedSession = await buildSessionFromGrant(
        currentSession.grant,
      );
      await saveGuestRoomSessionGrant(refreshedSession.grant);
      setSession(refreshedSession);
      setStatus("joined");
      setError(null);
      return refreshedSession;
    } catch (refreshError) {
      if (isExpiredGuestRoomError(refreshError)) {
        await clearGuestRoomSessionGrant();
        setSession(null);
        setStatus("expired");
        setError(getGuestRoomErrorMessage(refreshError));
        return null;
      }

      setStatus("failed");
      setError(
        getGuestRoomErrorMessage(
          refreshError,
          "Unable to refresh the room right now.",
        ),
      );
      return currentSession;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    refreshInFlightRef.current = false;
  }, []);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return;
    }

    pollingIntervalRef.current = setInterval(() => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      void refreshRoom().finally(() => {
        refreshInFlightRef.current = false;
      });
    }, GUEST_ROOM_POLL_INTERVAL_MS);
  }, [refreshRoom]);

  useEffect(() => {
    if (!activeGrant) {
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [activeGrant, startPolling, stopPolling]);

  const leaveRoom = useCallback(async () => {
    stopPolling();
    const guestToken = sessionRef.current?.grant.guestToken ?? null;
    if (guestToken) {
      // Best-effort server-side removal so the host's roster updates (FR-003).
      try {
        await getGuestRoomRpcClient().leaveRoomAsGuest(guestToken);
      } catch {
        // Ignore — local session is cleared regardless.
      }
    }
    await clearGuestRoomSessionGrant();
    setSession(null);
    setStatus("idle");
    setError(null);
    setPendingGuestToken(null);
  }, [stopPolling]);

  const joinRoom = useCallback(
    async (joinCode: string, guestName: string) => {
      const normalizedJoinCode = normalizeGuestRoomJoinCode(joinCode);
      const normalizedGuestName = normalizeGuestRoomDisplayName(guestName);

      if (!normalizedJoinCode) {
        setStatus("failed");
        setError("Enter a room code to join the room.");
        return null;
      }

      if (!normalizedGuestName) {
        setStatus("failed");
        setError(getGuestRoomErrorMessage("guest_name_required"));
        return null;
      }

      const nextGuestToken =
        session?.grant.guestToken ??
        pendingGuestToken ??
        createGuestRoomToken();

      if (!session?.grant.guestToken && !pendingGuestToken) {
        setPendingGuestToken(nextGuestToken);
      }

      setStatus("joining");
      setError(null);

      try {
        const response = await getGuestRoomRpcClient().joinRoomAsGuest({
          joinCode: normalizedJoinCode,
          guestName: normalizedGuestName,
          guestToken: nextGuestToken,
        });

        const nextSession = {
          grant: buildGuestRoomSessionGrant(response),
          snapshot: response.snapshot,
        } satisfies GuestRoomSession;

        await replaceSession(nextSession);

        return nextSession;
      } catch (joinError) {
        setStatus("failed");
        setError(getGuestRoomErrorMessage(joinError));
        throw joinError;
      }
    },
    [pendingGuestToken, replaceSession, session],
  );

  const setMyPicks = useCallback(
    async (matchIds: string[]) => {
      const guestToken = sessionRef.current?.grant.guestToken ?? null;
      if (!guestToken) {
        return;
      }

      setIsBusy(true);
      setError(null);
      try {
        await getGuestRoomRpcClient().setMyRoomPicksAsGuest(
          guestToken,
          matchIds,
        );
        // Refresh before clearing isBusy: the caller's controls stay disabled
        // until the snapshot reflects the write, so the next replace-all
        // submission is built from fresh picks rather than stale ones.
        await refreshRoom();
      } catch (pickError) {
        if (isExpiredGuestRoomError(pickError)) {
          await clearGuestRoomSessionGrant();
          setSession(null);
          setStatus("expired");
          setError(getGuestRoomErrorMessage(pickError));
          return;
        }
        setError(
          getGuestRoomErrorMessage(
            pickError,
            "Unable to save your picks right now.",
          ),
        );
      } finally {
        setIsBusy(false);
      }
    },
    [refreshRoom],
  );

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status,
    session,
    error,
    isBusy,
    joinRoom,
    refreshRoom,
    leaveRoom,
    replaceSession,
    setMyPicks,
  };
};
