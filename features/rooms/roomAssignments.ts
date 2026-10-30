import type { AssignmentQuality, AssignmentSets, SharingPolicy } from "../../shared/assignments/types";
import type { AssignmentMode, RoomSnapshot, RunningGameConfiguration } from "../../types/room";
import { generateIdempotencyKey } from "../../utils/idempotencyKey";

export interface AssignmentContext {
  revision: string;
  expectedToken: string;
  targetsByParticipantId?: Record<string, number>;
  configuration: Omit<RunningGameConfiguration, "assignmentMode"> & { assignmentMode: AssignmentMode };
}
export interface PreparedAssignmentPreview {
  proposalId: string | null;
  expiresAt: string | null;
  assignments: AssignmentSets;
  targetsByParticipantId: Record<string, number>;
  sharingPolicy: SharingPolicy;
  requiresSharingConsent: boolean;
  quality: AssignmentQuality | null;
}
export type AssignmentPreview = Readonly<Omit<PreparedAssignmentPreview, "proposalId">>;
export interface AssignmentIssue {
  issue: "busy" | "stale" | "expired" | "confirmation_required" | "unavailable" | "not_host" | "invalid_configuration";
}
interface PendingPreview { issue: "preview_pending" | "preview_busy"; retryAfterSeconds: number }
interface AssignmentRequest {
  sessionId: string;
  purpose: "start" | "running_save";
  context: AssignmentContext;
}
interface CommitRequest extends AssignmentRequest {
  proposalId: string | null;
  idempotencyKey: string;
  acceptRelaxedSharing: boolean;
}
export interface AssignmentTransport {
  prepare(request: AssignmentRequest): Promise<PreparedAssignmentPreview | PendingPreview>;
  commit(request: CommitRequest): Promise<RoomSnapshot | { code: "room_processing_pending"; retryAfterSeconds: number }>;
}

function frozenCopy<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  function freeze(item: unknown): void {
    if (!item || typeof item !== "object") return;
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  }
  freeze(copy);
  return copy;
}

/** One room/purpose owns preview ordering and uncertain commit recovery. */
export function createRoomAssignments(
  sessionId: string,
  purpose: "start" | "running_save",
  readContext: () => AssignmentContext,
  transport: AssignmentTransport,
  dependencies: { newKey?: () => string; now?: () => number; wait?: (milliseconds: number) => Promise<void> } = {},
) {
  const now = dependencies.now ?? Date.now;
  const newKey = dependencies.newKey ?? generateIdempotencyKey;
  const wait = dependencies.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const handles = new WeakMap<AssignmentPreview, { request: AssignmentRequest; proposalId: string | null; contextKey: string }>();
  const previews = new Map<string, Promise<AssignmentPreview | AssignmentIssue>>();
  let generation = 0;
  let previewQueue: Promise<unknown> = Promise.resolve();
  let pendingCommit: CommitRequest | undefined;
  let commitInFlight: Promise<RoomSnapshot | AssignmentIssue> | undefined;
  const keyFor = (context: AssignmentContext): string => JSON.stringify(context);
  const pause = (seconds: number): Promise<void> => wait(Math.max(0, Math.min(10, seconds)) * 1000);

  function preview(): Promise<AssignmentPreview | AssignmentIssue> {
    const context = frozenCopy(readContext());
    const contextKey = keyFor(context);
    const existing = previews.get(contextKey);
    if (existing) return existing;
    const currentGeneration = ++generation;
    const request: AssignmentRequest = frozenCopy({ sessionId, purpose, context });
    const operation = previewQueue.then(async (): Promise<AssignmentPreview | AssignmentIssue> => {
      const isCurrent = () => generation === currentGeneration && keyFor(readContext()) === contextKey;
      if (!isCurrent()) return { issue: "stale" };
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await transport.prepare(request);
          if (!isCurrent()) return { issue: "stale" };
          if ("issue" in response) {
            if (attempt === 2) return { issue: "busy" };
            await pause(response.retryAfterSeconds);
            if (!isCurrent()) return { issue: "stale" };
            continue;
          }
          const { proposalId, ...visible } = response;
          const reviewed = frozenCopy(visible);
          handles.set(reviewed, { request, proposalId, contextKey });
          return reviewed;
        }
      } catch (error) {
        const code = (error as { message?: string })?.message;
        if (code === "not_host") return { issue: "not_host" };
        if (code === "configuration_conflict") return { issue: "stale" };
        if (code && /^invalid_|^insufficient_|^per_player_|^missing_/.test(code)) return { issue: "invalid_configuration" };
        return { issue: "unavailable" };
      }
      return { issue: "busy" };
    });
    previews.set(contextKey, operation);
    previewQueue = operation;
    void operation.finally(() => { if (previews.get(contextKey) === operation) previews.delete(contextKey); });
    return operation;
  }

  function commit(
    reviewed: AssignmentPreview | AssignmentIssue,
    confirmation?: { acceptRelaxedSharing: boolean },
  ): Promise<RoomSnapshot | AssignmentIssue> {
    if (commitInFlight) return commitInFlight;
    if (!pendingCommit) {
      if ("issue" in reviewed) return Promise.resolve(reviewed);
      const handle = handles.get(reviewed);
      if (!handle || handle.contextKey !== keyFor(readContext())) return Promise.resolve({ issue: "stale" });
      if (reviewed.expiresAt && Date.parse(reviewed.expiresAt) <= now()) return Promise.resolve({ issue: "expired" });
      if (reviewed.requiresSharingConsent && !confirmation?.acceptRelaxedSharing) {
        return Promise.resolve({ issue: "confirmation_required" });
      }
      pendingCommit = frozenCopy({ ...handle.request, proposalId: handle.proposalId,
        idempotencyKey: newKey(), acceptRelaxedSharing: reviewed.requiresSharingConsent && confirmation?.acceptRelaxedSharing === true });
    }
    const request = pendingCommit;
    commitInFlight = (async (): Promise<RoomSnapshot | AssignmentIssue> => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await transport.commit(request);
          if ("code" in result) {
            if (attempt === 2) return { issue: "busy" };
            await pause(result.retryAfterSeconds);
            continue;
          }
          pendingCommit = undefined;
          return result;
        }
      } catch (error) {
        const code = (error as { message?: string })?.message;
        if (code === "not_host") { pendingCommit = undefined; return { issue: "not_host" }; }
        if (code === "configuration_conflict" || code === "assignment_proposal_superseded" || code === "invalid_assignment_proposal") {
          pendingCommit = undefined;
          return { issue: "stale" };
        }
        if (code === "assignment_proposal_expired") { pendingCommit = undefined; return { issue: "expired" }; }
        if (code && (/^invalid_|^assignment_count_|^insufficient_|^missing_|^target_below_|^per_player_/.test(code) || code === "idempotency_conflict")) {
          pendingCommit = undefined;
          return { issue: "invalid_configuration" };
        }
        return { issue: "unavailable" };
      }
      return { issue: "busy" };
    })();
    void commitInFlight.finally(() => { commitInFlight = undefined; });
    return commitInFlight;
  }
  return { preview, commit };
}
