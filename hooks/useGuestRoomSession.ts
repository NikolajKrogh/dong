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
  createGuestRoomRotationId,
  getGuestRoomErrorMessage,
  getGuestRoomErrorCode,
  isExpiredGuestRoomError,
  normalizeGuestRoomDisplayName,
  normalizeGuestRoomJoinCode,
  readAndRemoveLegacyGuestRoomSessionGrant,
  readGuestRoomPendingJoin,
  readGuestRoomPendingLeave,
  readGuestRoomPendingRotation,
  readGuestRoomSessionGrant,
  saveGuestRoomPendingJoin,
  saveGuestRoomPendingLeave,
  saveGuestRoomPendingRotation,
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
const GUEST_ROOM_RENEWAL_WINDOW_MS = 10 * 60 * 1000;

const grantFromPendingRotation = (record: NonNullable<Awaited<ReturnType<typeof readGuestRoomPendingRotation>>>): GuestRoomSessionGrant => ({
  guestToken: record.token,
  participantId: record.participantId,
  sessionId: record.sessionId,
  joinCode: record.joinCode,
  displayName: record.displayName,
  grantExpiresAt: record.grantExpiresAt,
});

const confirmPendingRotation = async (record: NonNullable<Awaited<ReturnType<typeof readGuestRoomPendingRotation>>>) => {
  const outcome = await getGuestRoomRpcClient().rotateGuestRoomGrant(
    record.token, record.replacementToken, record.operationId,
  );
  if (!outcome.ok) throw new Error(outcome.code);
  if (outcome.participantId !== record.participantId) throw new Error("guest_access_lost");
  const grant = {
    ...grantFromPendingRotation(record),
    guestToken: record.replacementToken,
    grantExpiresAt: outcome.grantExpiresAt,
  } satisfies GuestRoomSessionGrant;
  await saveGuestRoomSessionGrant(grant);
  return buildSessionFromGrant(grant);
};

const buildSessionFromGrant = async (grant: GuestRoomSessionGrant) => {
  const snapshot = await getGuestRoomRpcClient().getGuestRoomSnapshot(
    grant.guestToken,
  );

  return {
    grant: snapshot.grantExpiresAt ? { ...grant, grantExpiresAt: snapshot.grantExpiresAt } : grant,
    snapshot,
  } satisfies GuestRoomSession;
};

export const useGuestRoomSession = (): UseGuestRoomSessionResult => {
  const [status, setStatus] = useState<GuestRoomSessionStatus>("idle");
  const [session, setSession] = useState<GuestRoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const sessionRef = useRef<GuestRoomSession | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshInFlightRef = useRef(false);
  const leaveInFlightRef = useRef(false);
  const activeGrant = session?.grant ?? null;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    const restorePersistedSession = async () => {
      let restoringPendingLeave = false;
      let restoringPendingRotation = false;
      try {
        // The legacy AsyncStorage bearer is erased before the first network wait.
        const legacyGrant = await readAndRemoveLegacyGuestRoomSessionGrant();
        const pendingRotation = await readGuestRoomPendingRotation();
        const pendingLeave = await readGuestRoomPendingLeave();
        const pendingJoin = await readGuestRoomPendingJoin();
        const persistedGrant = await readGuestRoomSessionGrant();
        if (!isMounted) return;
        if (!pendingRotation && !pendingLeave && !pendingJoin && !persistedGrant && !legacyGrant) return;

        if (pendingRotation) {
          restoringPendingRotation = true;
          setStatus("renewing");
          const renewed = await confirmPendingRotation(pendingRotation);
          if (isMounted) {
            setSession(renewed);
            setStatus("joined");
            setError(null);
          }
          return;
        }

        if (pendingLeave) {
          restoringPendingLeave = true;
          setSession(null);
          setStatus("pending_leave");
          const outcome = await getGuestRoomRpcClient().leaveRoomAsGuest(pendingLeave.guestToken);
          if (outcome.ok) {
            await clearGuestRoomSessionGrant();
            if (isMounted) { setStatus("left"); setError(null); }
          } else if (outcome.code === "not_permitted") {
            await saveGuestRoomSessionGrant(pendingLeave);
            const restored = await buildSessionFromGrant(pendingLeave);
            if (isMounted) {
              setSession(restored);
              setStatus("joined");
              setError(getGuestRoomErrorMessage("not_permitted"));
            }
          } else if (isMounted) {
            setError(getGuestRoomErrorMessage(outcome.code));
          }
          return;
        }

        setStatus("refreshing");
        if (pendingJoin) {
          const response = await getGuestRoomRpcClient().joinRoomAsGuest({
            joinCode: pendingJoin.joinCode,
            guestName: pendingJoin.displayName,
            guestToken: pendingJoin.token,
          });
          const joined = { grant: buildGuestRoomSessionGrant(response), snapshot: response.snapshot } satisfies GuestRoomSession;
          await saveGuestRoomSessionGrant(joined.grant);
          if (!isMounted) return;
          setSession(joined);
          setStatus("joined");
          setError(null);
          return;
        }

        const grant = persistedGrant ?? legacyGrant;
        if (!grant) return;
        const restoredSession = await buildSessionFromGrant(grant);
        if (legacyGrant && !persistedGrant) await saveGuestRoomSessionGrant(restoredSession.grant);

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
        setStatus(hasExpiredGrant
          ? (restoringPendingLeave ? "idle" : "expired")
          : restoringPendingLeave ? "pending_leave" : restoringPendingRotation ? "renewing" : "failed");
        setError(
          restoringPendingLeave
            ? "Could not confirm departure. We will retry when you reconnect."
            : restoringPendingRotation && !hasExpiredGrant
              ? "Guest access renewal is pending. We will retry when connected."
            : getGuestRoomErrorMessage(restoreError, "Unable to restore the room right now."),
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
        return;
      }

      await saveGuestRoomSessionGrant(nextSession.grant);
      setSession(nextSession);
      setStatus("joined");
      setError(null);
    },
    [],
  );

  const refreshRoom = useCallback(async () => {
    const currentSession = sessionRef.current;
    let rotationPending = false;
    try {
      let pendingRotation = await readGuestRoomPendingRotation();
      const snapshotGrant = currentSession?.grant ?? (!pendingRotation ? await readGuestRoomSessionGrant() : null);
      if (!snapshotGrant && !pendingRotation) return null;
      const expiry = snapshotGrant?.grantExpiresAt;
      if (!pendingRotation && expiry && Date.parse(expiry) - Date.now() <= GUEST_ROOM_RENEWAL_WINDOW_MS) {
        const replacementToken = await createGuestRoomToken();
        const operationId = await createGuestRoomRotationId();
        await saveGuestRoomPendingRotation(snapshotGrant!, replacementToken, operationId);
        pendingRotation = await readGuestRoomPendingRotation();
        // The just-written record must be readable before a server mutation.
        if (!pendingRotation) throw new Error("protected_storage_unavailable");
      }
      if (pendingRotation) {
        rotationPending = true;
        setSession(null);
        setStatus("renewing");
        const renewed = await confirmPendingRotation(pendingRotation);
        setSession(renewed);
        setStatus("joined");
        setError(null);
        return renewed;
      }

      setStatus("refreshing");
      const refreshedSession = await buildSessionFromGrant(
        snapshotGrant!,
      );
      setSession(refreshedSession);
      setStatus("joined");
      setError(null);
      return refreshedSession;
    } catch (refreshError) {
      if (rotationPending) {
        if (getGuestRoomErrorCode(refreshError) === "room_unavailable") {
          try {
            const deniedRotation = await readGuestRoomPendingRotation();
            if (deniedRotation) {
              const originalGrant = grantFromPendingRotation(deniedRotation);
              await saveGuestRoomSessionGrant(originalGrant);
              try {
                const finalSession = await buildSessionFromGrant(originalGrant);
                setSession(finalSession);
                setStatus("joined");
                setError(null);
                return finalSession;
              } catch {
                await clearGuestRoomSessionGrant();
                setSession(null);
                setStatus("expired");
                setError(getGuestRoomErrorMessage("guest_access_lost"));
                return null;
              }
            }
          } catch {
            setSession(null);
            setStatus("renewing");
            setError(getGuestRoomErrorMessage("protected_storage_unavailable"));
            return null;
          }
        }
        if (isExpiredGuestRoomError(refreshError)) {
          await clearGuestRoomSessionGrant();
          setSession(null);
          setStatus("expired");
          setError(getGuestRoomErrorMessage(refreshError));
          return null;
        }
        setSession(null);
        setStatus("renewing");
        setError("Guest access renewal is pending. We will retry when connected.");
        return null;
      }
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
    }, status === "renewing" ? 5000 : GUEST_ROOM_POLL_INTERVAL_MS);
  }, [refreshRoom, status]);

  useEffect(() => {
    if (!activeGrant && status !== "renewing") {
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [activeGrant, startPolling, status, stopPolling]);

  const leaveRoom = useCallback(async () => {
    if (leaveInFlightRef.current) return;
    leaveInFlightRef.current = true;
    stopPolling();
    const currentSession = sessionRef.current;
    try {
      const grant = currentSession?.grant ?? await readGuestRoomPendingLeave();
      if (!grant) return;
      if (currentSession) await saveGuestRoomPendingLeave(grant);
      setSession(null);
      setStatus("pending_leave");
      setError(null);
      try {
        const outcome = await getGuestRoomRpcClient().leaveRoomAsGuest(grant.guestToken);
        if (outcome.ok) {
          await clearGuestRoomSessionGrant();
          setStatus("left");
        } else if (outcome.code === "not_permitted") {
          await saveGuestRoomSessionGrant(grant);
          const restored = currentSession ?? await buildSessionFromGrant(grant);
          setSession(restored);
          setStatus("joined");
          setError(getGuestRoomErrorMessage("not_permitted"));
        } else {
          setError(getGuestRoomErrorMessage(outcome.code));
        }
      } catch {
        setError("Could not confirm departure. We will retry when you reconnect.");
      }
    } catch (storageError) {
      setStatus("failed");
      setError(getGuestRoomErrorMessage(storageError));
    } finally {
      leaveInFlightRef.current = false;
    }
  }, [stopPolling]);

  useEffect(() => {
    if (status !== "pending_leave") return;
    const timer = setInterval(() => { void leaveRoom(); }, 5000);
    return () => clearInterval(timer);
  }, [leaveRoom, status]);

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

      setStatus("joining");
      setError(null);

      try {
        const storedPending = await readGuestRoomPendingJoin();
        const samePending = storedPending?.joinCode === normalizedJoinCode && storedPending.displayName === normalizedGuestName;
        const nextGuestToken =
          session?.grant.guestToken ??
          (samePending ? storedPending.token : null) ??
          await createGuestRoomToken();

        if (!session?.grant.guestToken) {
          await saveGuestRoomPendingJoin(normalizedJoinCode, normalizedGuestName, nextGuestToken);
        }

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
        return null;
      }
    },
    [replaceSession, session],
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
