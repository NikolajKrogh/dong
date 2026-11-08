import { useLayoutEffect, useRef, useState } from "react";
import type { RoomAssignmentInput } from "../../types/room";
import type { AssignmentContext, AssignmentIssue, AssignmentPreview } from "./roomAssignments";
import { createRoomAssignments } from "./roomAssignments";
import { createRoomAssignmentTransport } from "./roomAssignmentTransport";

const ASSIGNMENT_ISSUE_MESSAGES: Record<AssignmentIssue["issue"], string> = {
  busy: "Another assignment request is still processing. Try again shortly.",
  stale: "The room or draft changed. Review a new preview before continuing.",
  expired: "This preview expired. Generate a new preview.",
  confirmation_required: "Confirm relaxed sharing for this preview before continuing.",
  unavailable: "The assignment request could not be confirmed. Retry to recover the same request.",
  not_host: "Only the current host can change assignments. Refresh the room.",
  invalid_configuration: "Check the match counts and selections, then review a new preview. Your draft has been kept.",
};

export function useAssignmentPreview(sessionId: string, purpose: "start" | "running_save", context: AssignmentContext, options?: { editable: boolean; poolIds: string[] }) {
  const contextKey = JSON.stringify([sessionId, context.revision, context.configuration, options?.poolIds]);
  const [draft, setDraft] = useState<{ sessionId: string; mode: AssignmentContext["configuration"]["assignmentMode"]; key: string; assignments: RoomAssignmentInput[]; status: "ungenerated" | "generated" | "edited" | "stale" }>(() => ({
    sessionId, mode: context.configuration.assignmentMode, key: contextKey, assignments: context.configuration.assignments, status: purpose === "running_save" ? "edited" : "ungenerated",
  }));
  const activeDraft = draft.sessionId === sessionId && draft.mode === context.configuration.assignmentMode ? draft : { sessionId, mode: context.configuration.assignmentMode, key: contextKey, assignments: context.configuration.assignments, status: "ungenerated" as const };
  const poolIds = options ? new Set(options.poolIds) : null;
  const assignments = activeDraft.assignments.filter(a => a.participantId in (context.targetsByParticipantId ?? {}) && (!poolIds || poolIds.has(a.matchId)));
  const valid = Object.entries(context.targetsByParticipantId ?? {}).every(([id, target]) => assignments.filter(a => a.participantId === id).length === target);
  function toggleAssignment(participantId: string, matchId: string) {
    if (isBusy || recoveryRequired || !options?.editable) return;
    const exists = assignments.some(a => a.participantId === participantId && a.matchId === matchId);
    setDraft({ sessionId, mode: context.configuration.assignmentMode, key: contextKey, status: "edited", assignments: exists
      ? assignments.filter(a => a.participantId !== participantId || a.matchId !== matchId)
      : [...assignments, { participantId, matchId }] });
  }
  const latestContextRef = useRef(context);
  useLayoutEffect(() => { latestContextRef.current = context; }, [context]);
  const workflowOwnerRef = useRef<{ sessionId: string; purpose: string; assignmentWorkflow: ReturnType<typeof createRoomAssignments> } | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<AssignmentIssue["issue"] | null>(null);
  function getOrCreateAssignmentWorkflow() {
    if (!workflowOwnerRef.current || workflowOwnerRef.current.sessionId !== sessionId || workflowOwnerRef.current.purpose !== purpose) {
      workflowOwnerRef.current = { sessionId, purpose, assignmentWorkflow: createRoomAssignments(sessionId, purpose, () => latestContextRef.current, createRoomAssignmentTransport()) };
    }
    return workflowOwnerRef.current.assignmentWorkflow;
  }
  async function review(): Promise<void> {
    setIsBusy(true);
    setError(null);
    setIssue(null);
    try {
      const result = await getOrCreateAssignmentWorkflow().preview();
      if ("issue" in result) { setIssue(result.issue); setError(ASSIGNMENT_ISSUE_MESSAGES[result.issue]); setPreview(null); }
      else {
        setPreview(result);
        if (options?.editable) setDraft({ sessionId, mode: context.configuration.assignmentMode, key: contextKey, status: "generated", assignments: Object.entries(result.assignments).flatMap(([participantId, ids]) => ids.map(matchId => ({ participantId, matchId }))) });
      }
    } finally { setIsBusy(false); }
  }
  async function commit(acceptRelaxedSharing = false) {
    if (options?.editable && activeDraft.status === "generated" && preview?.requiresSharingConsent && !acceptRelaxedSharing) {
      setIssue("confirmation_required"); setError("Confirm relaxed sharing before starting."); return null;
    }
    if (!options?.editable && !preview) { setError("Review assignments before continuing."); return null; }
    setIsBusy(true);
    setError(null);
    setIssue(null);
    try {
      const result = await getOrCreateAssignmentWorkflow().commit(preview, { acceptRelaxedSharing }, options?.editable ? assignments : undefined);
      if ("issue" in result) { setRecoveryRequired(result.issue === "busy" || result.issue === "unavailable"); setIssue(result.issue); setError(ASSIGNMENT_ISSUE_MESSAGES[result.issue]); return null; }
      setRecoveryRequired(false);
      return result;
    } finally { setIsBusy(false); }
  }
  function resetDraft() {
    setDraft({ sessionId, mode: context.configuration.assignmentMode, key: contextKey, status: "ungenerated", assignments: [] });
    setPreview(null);
  }
  return { assignments, valid, toggleAssignment, resetDraft,
    status: activeDraft.key !== contextKey ? "stale" as const : activeDraft.status,
    hasRandomized: activeDraft.status !== "ungenerated",
    preview, recoveryRequired, isBusy, error, issue, review, commit };
}
