import {
  type MutableRefObject
} from "react";
import type { GuestRoomSessionGrant } from "../../types/guestRoom";
import type {
  ActiveGameContext
} from "../../types/room";
import type { ActiveGameSyncStatus, GameplayAction, PendingGameplayMutation, StateSetter } from "./activeGameTypes";
import {
  type CompatibleRoomSnapshot
} from "./roomSnapshotAdapter";

interface SyncIdentityStateParams {
  identity: string;
  previousIdentity: string;
  context: Pick<ActiveGameContext, "mode">;
  accessLost: boolean;
  setPreviousIdentity: StateSetter<string>;
  setPendingMutations: StateSetter<PendingGameplayMutation[]>;
  setSnapshot: StateSetter<CompatibleRoomSnapshot | null>;
  setStatus: StateSetter<ActiveGameSyncStatus>;
  setError: StateSetter<string | null>;
  setAccessLost: StateSetter<boolean>;
}

export const syncIdentityStateDuringRender = ({
  identity,
  previousIdentity,
  context,
  accessLost,
  setPreviousIdentity,
  setPendingMutations,
  setSnapshot,
  setStatus,
  setError,
  setAccessLost,
}: SyncIdentityStateParams) => {
  if (previousIdentity === identity) return;
  setPreviousIdentity(identity);
  setPendingMutations([]);
  if (context.mode === "multiplayer" || !accessLost) {
    setSnapshot(null);
    setStatus(context.mode === "multiplayer" ? "hydrating" : "idle");
    setError(null);
  }
  if (context.mode === "multiplayer" && accessLost) setAccessLost(false);
};

interface ResetRoomRuntimeParams {
  generationRef: MutableRefObject<number>;
  refreshInFlightRef: MutableRefObject<number | null>;
  guestGrantRef: MutableRefObject<GuestRoomSessionGrant | null>;
  completionInFlightRef: MutableRefObject<boolean>;
  pendingRef: MutableRefObject<PendingGameplayMutation[]>;
  actionsRef: MutableRefObject<Map<string, GameplayAction>>;
  snapshotRef: MutableRefObject<CompatibleRoomSnapshot | null>;
  context: Pick<ActiveGameContext, "mode">;
  accessLost: boolean;
}

export const resetRoomRuntimeForIdentity = ({
  generationRef,
  refreshInFlightRef,
  guestGrantRef,
  completionInFlightRef,
  pendingRef,
  actionsRef,
  snapshotRef,
  context,
  accessLost,
}: ResetRoomRuntimeParams) => {
  generationRef.current += 1;
  refreshInFlightRef.current = null;
  guestGrantRef.current = null;
  completionInFlightRef.current = false;
  pendingRef.current = [];
  actionsRef.current.clear();
  if (context.mode === "multiplayer" || !accessLost) snapshotRef.current = null;
};
