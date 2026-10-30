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

function createFrozenCopy<T>(value: T): T {
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
  const previewHandles = new WeakMap<AssignmentPreview, { request: AssignmentRequest; proposalId: string | null; contextKey: string }>();
  const inFlightPreviewsByContext = new Map<string, Promise<AssignmentPreview | AssignmentIssue>>();
  let latestPreviewGeneration = 0;
  let previewRequestQueue: Promise<unknown> = Promise.resolve();
  let pendingCommitRequest: CommitRequest | undefined;
  let inFlightCommit: Promise<RoomSnapshot | AssignmentIssue> | undefined;
  const serializeContext = (context: AssignmentContext): string => JSON.stringify(context);
  const waitForRetry = (seconds: number): Promise<void> => wait(Math.max(0, Math.min(10, seconds)) * 1000);

  function preview(): Promise<AssignmentPreview | AssignmentIssue> {
    const context = createFrozenCopy(readContext());
    const contextKey = serializeContext(context);
    const existingPreviewRequest = inFlightPreviewsByContext.get(contextKey);
    if (existingPreviewRequest) return existingPreviewRequest;
    const previewGeneration = ++latestPreviewGeneration;
    const request: AssignmentRequest = createFrozenCopy({ sessionId, purpose, context });
    const previewOperation = previewRequestQueue.then(async (): Promise<AssignmentPreview | AssignmentIssue> => {
      const isCurrent = () => latestPreviewGeneration === previewGeneration && serializeContext(readContext()) === contextKey;
      if (!isCurrent()) return { issue: "stale" };
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await transport.prepare(request);
          if (!isCurrent()) return { issue: "stale" };
          if ("issue" in response) {
            if (attempt === 2) return { issue: "busy" };
            await waitForRetry(response.retryAfterSeconds);
            if (!isCurrent()) return { issue: "stale" };
            continue;
          }
          const { proposalId, ...previewDetails } = response;
          const reviewedPreview = createFrozenCopy(previewDetails);
          previewHandles.set(reviewedPreview, { request, proposalId, contextKey });
          return reviewedPreview;
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
    inFlightPreviewsByContext.set(contextKey, previewOperation);
    previewRequestQueue = previewOperation;
    void previewOperation.finally(() => { if (inFlightPreviewsByContext.get(contextKey) === previewOperation) inFlightPreviewsByContext.delete(contextKey); });
    return previewOperation;
  }

  function commit(
    reviewedPreview: AssignmentPreview | AssignmentIssue,
    confirmation?: { acceptRelaxedSharing: boolean },
  ): Promise<RoomSnapshot | AssignmentIssue> {
    if (inFlightCommit) return inFlightCommit;
    if (!pendingCommitRequest) {
      if ("issue" in reviewedPreview) return Promise.resolve(reviewedPreview);
      const previewHandle = previewHandles.get(reviewedPreview);
      if (!previewHandle || previewHandle.contextKey !== serializeContext(readContext())) return Promise.resolve({ issue: "stale" });
      if (reviewedPreview.expiresAt && Date.parse(reviewedPreview.expiresAt) <= now()) return Promise.resolve({ issue: "expired" });
      if (reviewedPreview.requiresSharingConsent && !confirmation?.acceptRelaxedSharing) {
        return Promise.resolve({ issue: "confirmation_required" });
      }
      pendingCommitRequest = createFrozenCopy({ ...previewHandle.request, proposalId: previewHandle.proposalId,
        idempotencyKey: newKey(), acceptRelaxedSharing: reviewedPreview.requiresSharingConsent && confirmation?.acceptRelaxedSharing === true });
    }
    const request = pendingCommitRequest;
    inFlightCommit = (async (): Promise<RoomSnapshot | AssignmentIssue> => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await transport.commit(request);
          if ("code" in result) {
            if (attempt === 2) return { issue: "busy" };
            await waitForRetry(result.retryAfterSeconds);
            continue;
          }
          pendingCommitRequest = undefined;
          return result;
        }
      } catch (error) {
        const code = (error as { message?: string })?.message;
        if (code === "not_host") { pendingCommitRequest = undefined; return { issue: "not_host" }; }
        if (code === "configuration_conflict" || code === "assignment_proposal_superseded" || code === "invalid_assignment_proposal") {
          pendingCommitRequest = undefined;
          return { issue: "stale" };
        }
        if (code === "assignment_proposal_expired") { pendingCommitRequest = undefined; return { issue: "expired" }; }
        if (code && (/^invalid_|^assignment_count_|^insufficient_|^missing_|^target_below_|^per_player_/.test(code) || code === "idempotency_conflict")) {
          pendingCommitRequest = undefined;
          return { issue: "invalid_configuration" };
        }
        return { issue: "unavailable" };
      }
      return { issue: "busy" };
    })();
    void inFlightCommit.finally(() => { inFlightCommit = undefined; });
    return inFlightCommit;
  }
  return { preview, commit };
}
