import { useLayoutEffect, useRef, useState } from "react";
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

export function useAssignmentPreview(sessionId: string, purpose: "start" | "running_save", context: AssignmentContext) {
  const latestContextRef = useRef(context);
  useLayoutEffect(() => { latestContextRef.current = context; }, [context]);
  const workflowOwnerRef = useRef<{ sessionId: string; purpose: string; assignmentWorkflow: ReturnType<typeof createRoomAssignments> } | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
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
      else setPreview(result);
    } finally { setIsBusy(false); }
  }
  async function commit(acceptRelaxedSharing = false) {
    if (!preview) { setError("Review assignments before continuing."); return null; }
    setIsBusy(true);
    setError(null);
    setIssue(null);
    try {
      const result = await getOrCreateAssignmentWorkflow().commit(preview, { acceptRelaxedSharing });
      if ("issue" in result) { setIssue(result.issue); setError(ASSIGNMENT_ISSUE_MESSAGES[result.issue]); return null; }
      return result;
    } finally { setIsBusy(false); }
  }
  return { preview, isBusy, error, issue, review, commit };
}
