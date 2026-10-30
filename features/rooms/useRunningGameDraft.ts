import { useRef, useState } from "react";
import type { Match } from "../../store/gameStore";
import type { RoomSnapshot, RunningGameConfiguration } from "../../types/room";
import { generateIdempotencyKey } from "../../utils/idempotencyKey";
import { getRoomRpcClient } from "./roomRpcClient";
import { roomSnapshotToActiveRoster } from "./roomSnapshotAdapter";
import { useAssignmentPreview } from "./useAssignmentPreview";
import { toAddRequest, toDisplayMatch } from "./useRoomMatchPool";

export function useRunningGameDraft(snapshot: RoomSnapshot, currentSnapshot = snapshot) {
  const [matches, setMatches] = useState(() => snapshot.matches.map(toDisplayMatch));
  const [mode, setMode] = useState<RunningGameConfiguration["assignmentMode"]>(
    snapshot.assignmentMode === "automatic" ? "automatic" : "host_assigned",
  );
  const [settings, setSettings] = useState({
    matchesPerPlayer: snapshot.assignmentPlan.matchesPerPlayer,
    sharedMatchesPerPair: snapshot.assignmentPlan.sharedMatchesPerPair,
  });
  const [assignments, setAssignments] = useState(() => snapshot.assignments.filter(assignment => assignment.matchId !== snapshot.commonMatchId));
  const [playerMatchCounts, setPlayerMatchCounts] = useState<Record<string, number>>(() => Object.fromEntries(
    roomSnapshotToActiveRoster(snapshot).filter(participant => participant.additionalMatchCount != null).map(participant => [participant.id, participant.additionalMatchCount!]),
  ));
  const supportsTargets = snapshot.capabilities?.perPlayerMatchCounts === true;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const isLegacySaveInFlightRef = useRef(false);
  const legacySaveRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const participants = roomSnapshotToActiveRoster(snapshot);
  const fixedMatchIds = snapshot.matches.map(match => match.id);
  const fixedMatchIdSet = new Set(fixedMatchIds);
  const activeParticipantIds = new Set(participants.map(participant => participant.id));
  const targetsByParticipantId = Object.fromEntries(participants.map(participant => [participant.id, playerMatchCounts[participant.id] ?? settings.matchesPerPlayer]));
  const plan = buildDraftAssignmentPlan(snapshot.assignmentPlan, settings, mode, targetsByParticipantId, participants.length, matches.length, supportsTargets);
  const matchIds = new Set(matches.map(match => match.id));
  const isAssignmentDraftValid = mode === "automatic" || participants.every(participant => {
    const selectedCount = assignments.filter(assignment =>
      assignment.participantId === participant.id && matchIds.has(assignment.matchId),
    ).length;
    const target = supportsTargets ? targetsByParticipantId[participant.id] : plan.effectivePerPlayer;
    return selectedCount === target;
  });
  const configuration: RunningGameConfiguration = {
    assignmentMode: mode, ...settings,
    ...(supportsTargets ? { assignmentPolicyVersion: 2 as const, playerMatchCounts } : {}),
    newMatches: matches.filter(match => !fixedMatchIdSet.has(match.id)).map(match => ({ ...toAddRequest(match), clientId: match.id })),
    assignments: assignments.filter(assignment => activeParticipantIds.has(assignment.participantId)),
  };
  const assignmentPreview = useAssignmentPreview(snapshot.sessionId, "running_save", {
    revision: currentSnapshot.configurationToken ?? "", expectedToken: snapshot.configurationToken ?? "",
    targetsByParticipantId, configuration,
  });

  function updateMatches(next: Match[]): void {
    if (isLegacySaveInFlightRef.current) return;
    const matchesById = new Map(next.map(match => [match.id, match]));
    for (const match of snapshot.matches) matchesById.set(match.id, toDisplayMatch(match));
    setMatches([...matchesById.values()]);
    setAssignments(previous => previous.filter(assignment => matchesById.has(assignment.matchId)));
  }

  function toggleAssignment(participantId: string, matchId: string): void {
    if (isSaving || !activeParticipantIds.has(participantId) || matchId === snapshot.commonMatchId) return;
    setAssignments(previous => {
      const exists = previous.some(assignment => assignment.participantId === participantId && assignment.matchId === matchId);
      if (exists) return previous.filter(assignment => assignment.participantId !== participantId || assignment.matchId !== matchId);
      const target = supportsTargets ? targetsByParticipantId[participantId] : plan.effectivePerPlayer;
      if (previous.filter(assignment => assignment.participantId === participantId).length >= target) return previous;
      return [...previous, { participantId, matchId }];
    });
  }

  async function save(acceptRelaxedSharing = false): Promise<RoomSnapshot | null> {
    if (isLegacySaveInFlightRef.current || !snapshot.configurationToken) return null;
    if (supportsTargets) return assignmentPreview.commit(acceptRelaxedSharing);
    if (!plan.feasible || !isAssignmentDraftValid) return null;
    const fingerprint = JSON.stringify(configuration);
    if (legacySaveRequestRef.current?.fingerprint !== fingerprint) {
      legacySaveRequestRef.current = { fingerprint, key: generateIdempotencyKey() };
    }
    isLegacySaveInFlightRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      return await getRoomRpcClient().saveRunningGameConfiguration({
        sessionId: snapshot.sessionId, configuration, expectedToken: snapshot.configurationToken,
        idempotencyKey: legacySaveRequestRef.current.key,
      });
    } catch (failure) {
      const conflict = (failure as { message?: string })?.message === "configuration_conflict";
      setHasConflict(conflict);
      setError(conflict
        ? "The room configuration changed while you were editing. Your draft has been kept. Reload the room to start again."
        : "Changes could not be saved. Check your connection and try again. Your draft has been kept.");
      return null;
    } finally {
      isLegacySaveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  function setPlayerMatchCount(id: string, count: number | null): void {
    setPlayerMatchCounts(previous => {
      const next = { ...previous };
      if (count === null) delete next[id];
      else next[id] = count;
      return next;
    });
  }

  return {
    supportsTargets, assignmentPreview, setPlayerMatchCount,
    matches, updateMatches, mode, setMode, settings, setSettings, plan,
    participants: supportsTargets ? participants.map(participant => ({ ...participant, additionalMatchCount: playerMatchCounts[participant.id] ?? null })) : participants,
    fixedMatchIds,
    assignments, toggleAssignment, isSaving: isSaving || assignmentPreview.isBusy,
    error: error ?? assignmentPreview.error, hasConflict: hasConflict || assignmentPreview.issue === "stale", save,
    canSave: Boolean(snapshot.configurationToken) && plan.feasible && isAssignmentDraftValid && !hasConflict && assignmentPreview.issue !== "stale",
  };
}

function buildDraftAssignmentPlan(
  baseline: RoomSnapshot["assignmentPlan"],
  settings: Pick<RunningGameConfiguration, "matchesPerPlayer" | "sharedMatchesPerPair">,
  mode: RunningGameConfiguration["assignmentMode"],
  targetsByParticipantId: Record<string, number>,
  participantCount: number,
  poolSize: number,
  supportsTargets: boolean,
): RoomSnapshot["assignmentPlan"] {
  let effectivePerPlayer = settings.matchesPerPlayer;
  let requiredPoolSize = effectivePerPlayer + 1;
  if (supportsTargets) {
    effectivePerPlayer = Math.max(0, ...Object.values(targetsByParticipantId));
    requiredPoolSize = effectivePerPlayer + 1;
  } else if (mode === "automatic") {
    effectivePerPlayer = Math.max(settings.matchesPerPlayer, settings.sharedMatchesPerPair * Math.max(0, participantCount - 1));
    requiredPoolSize = participantCount * effectivePerPlayer - participantCount * (participantCount - 1) / 2 * settings.sharedMatchesPerPair + 1;
  }
  const feasible = supportsTargets ? poolSize > effectivePerPlayer : poolSize >= requiredPoolSize;
  return {
    ...baseline, ...settings, participantCount, poolSize,
    effectivePerPlayer, requiredPoolSize, relaxedFloor: requiredPoolSize,
    feasible, startable: feasible,
    targetsByParticipantId: supportsTargets ? targetsByParticipantId : undefined,
  };
}
