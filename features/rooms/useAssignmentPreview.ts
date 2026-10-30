import { useLayoutEffect, useRef, useState } from "react";
import type { AssignmentContext, AssignmentIssue, AssignmentPreview } from "./roomAssignments";
import { createRoomAssignments } from "./roomAssignments";
import { createRoomAssignmentTransport } from "./roomAssignmentTransport";

const messages: Record<AssignmentIssue["issue"], string> = {
  busy: "Another assignment request is still processing. Try again shortly.",
  stale: "The room or draft changed. Review a new preview before continuing.",
  expired: "This preview expired. Generate a new preview.",
  confirmation_required: "Confirm relaxed sharing for this preview before continuing.",
  unavailable: "The assignment request could not be confirmed. Retry to recover the same request.",
  not_host: "Only the current host can change assignments. Refresh the room.",
  invalid_configuration: "Check the match counts and selections, then review a new preview. Your draft has been kept.",
};

export function useAssignmentPreview(sessionId: string, purpose: "start" | "running_save", context: AssignmentContext) {
  const latest = useRef(context);
  useLayoutEffect(() => { latest.current = context; }, [context]);
  const owner = useRef<{ sessionId: string; purpose: string; module: ReturnType<typeof createRoomAssignments> } | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<AssignmentIssue["issue"] | null>(null);
  function getModule() {
    if (!owner.current || owner.current.sessionId !== sessionId || owner.current.purpose !== purpose) {
      owner.current = { sessionId, purpose, module: createRoomAssignments(sessionId, purpose, () => latest.current, createRoomAssignmentTransport()) };
    }
    return owner.current.module;
  }
  async function review(): Promise<void> {
    setBusy(true);
    setError(null);
    setIssue(null);
    try {
      const result = await getModule().preview();
      if ("issue" in result) { setIssue(result.issue); setError(messages[result.issue]); setPreview(null); }
      else setPreview(result);
    } finally { setBusy(false); }
  }
  async function commit(acceptRelaxedSharing = false) {
    if (!preview) { setError("Review assignments before continuing."); return null; }
    setBusy(true);
    setError(null);
    setIssue(null);
    try {
      const result = await getModule().commit(preview, { acceptRelaxedSharing });
      if ("issue" in result) { setIssue(result.issue); setError(messages[result.issue]); return null; }
      return result;
    } finally { setBusy(false); }
  }
  return { preview, isBusy, error, issue, review, commit };
}
