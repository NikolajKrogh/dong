import { useEffect, useRef, useState } from "react";
import type { Match } from "../../store/gameStore";
import { ASSIGNMENT_MODE, ASSIGNMENT_POLICY_VERSION, type RoomSnapshot, type RunningGameConfiguration } from "../../types/room";
import { COMMON_MATCH_COUNT, DEFAULT_SHARED_MATCHES_PER_PAIR } from "../../shared/assignments/types";
import { generateIdempotencyKey } from "../../utils/idempotencyKey";
import { getRoomRpcClient } from "./roomRpcClient";
import { roomSnapshotToActiveRoster } from "./roomSnapshotAdapter";
import { useAssignmentPreview } from "./useAssignmentPreview";
import { ASSIGNMENT_PURPOSE } from "./roomAssignments";
import { toAddRequest, toDisplayMatch } from "./useRoomMatchPool";

export function useRunningGameDraft(snapshot: RoomSnapshot, currentSnapshot = snapshot) {
  const [matches, setMatches] = useState(() => snapshot.matches.map(toDisplayMatch));
  const [mode, setMode] = useState<RunningGameConfiguration["assignmentMode"]>(
    snapshot.assignmentMode === ASSIGNMENT_MODE.automatic ? ASSIGNMENT_MODE.automatic : ASSIGNMENT_MODE.hostAssigned,
  );
  const [settings, setSettings] = useState({
    matchesPerPlayer: snapshot.assignmentPlan.matchesPerPlayer,
    sharedMatchesPerPair: snapshot.assignmentPlan.sharedMatchesPerPair,
  });
  const [assignments, setAssignments] = useState(() => snapshot.assignments.filter(assignment => assignment.matchId !== snapshot.commonMatchId));
  const [playerMatchCounts, setPlayerMatchCounts] = useState<Record<string, number>>(() => Object.fromEntries(
    roomSnapshotToActiveRoster(snapshot).filter(participant => participant.additionalMatchCount != null).map(participant => [participant.id, participant.additionalMatchCount!]),
  ));
  const supportsEditable = snapshot.assignmentPolicyVersion === ASSIGNMENT_POLICY_VERSION.editable && snapshot.capabilities?.editableAutomaticAssignments === true;
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
  const isAssignmentDraftValid = mode === ASSIGNMENT_MODE.automatic || participants.every(participant => {
    const selectedCount = assignments.filter(assignment =>
      assignment.participantId === participant.id && matchIds.has(assignment.matchId),
    ).length;
    const target = supportsTargets ? targetsByParticipantId[participant.id] : plan.effectivePerPlayer;
    return selectedCount === target;
  });
  const configuration: RunningGameConfiguration = {
    assignmentMode: mode, ...settings,
    ...(supportsTargets ? { assignmentPolicyVersion: ASSIGNMENT_POLICY_VERSION.editable, playerMatchCounts } : {}),
    newMatches: matches.filter(match => !fixedMatchIdSet.has(match.id)).map(match => ({ ...toAddRequest(match), clientId: match.id })),
    assignments: assignments.filter(assignment => activeParticipantIds.has(assignment.participantId)),
  };
  const assignmentPreview = useAssignmentPreview(snapshot.sessionId, ASSIGNMENT_PURPOSE.runningSave, {
    revision: currentSnapshot.configurationToken ?? "", expectedToken: snapshot.configurationToken ?? "",
    targetsByParticipantId, configuration,
  }, { editable: supportsEditable, poolIds: matches.filter(m => m.id !== snapshot.commonMatchId).map(m => m.id) });

  function updateMatches(next: Match[]): void {
    if (isLegacySaveInFlightRef.current) return;
    const matchesById = new Map(next.map(match => [match.id, match]));
    for (const match of snapshot.matches) matchesById.set(match.id, toDisplayMatch(match));
    setMatches([...matchesById.values()]);
    setAssignments(previous => previous.filter(assignment => matchesById.has(assignment.matchId)));
  }

  function toggleAssignment(participantId: string, matchId: string): void {
    if (supportsEditable) { assignmentPreview.toggleAssignment(participantId, matchId); return; }
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

  const randomizeRequested = useRef(false);
  function randomizeAssignments() {
    if (settings.sharedMatchesPerPair === DEFAULT_SHARED_MATCHES_PER_PAIR) { void assignmentPreview.review(); return; }
    randomizeRequested.current = true;
    setSettings(previous => ({ ...previous, sharedMatchesPerPair: DEFAULT_SHARED_MATCHES_PER_PAIR }));
  }
  useEffect(() => {
    if (randomizeRequested.current && settings.sharedMatchesPerPair === DEFAULT_SHARED_MATCHES_PER_PAIR) {
      randomizeRequested.current = false;
      void assignmentPreview.review();
    }
  }, [settings.sharedMatchesPerPair, assignmentPreview]);

  function setPlayerMatchCount(id: string, count: number | null): void {
    setPlayerMatchCounts(previous => {
      const next = { ...previous };
      if (count === null) delete next[id];
      else next[id] = count;
      return next;
    });
  }

  return {
    supportsEditable, randomizeAssignments, supportsTargets, assignmentPreview, setPlayerMatchCount,
    matches, updateMatches, mode, setMode, settings, setSettings, plan,
    participants: supportsTargets ? participants.map(participant => ({ ...participant, additionalMatchCount: playerMatchCounts[participant.id] ?? null })) : participants,
    fixedMatchIds,
    assignments: supportsEditable ? assignmentPreview.assignments : assignments, toggleAssignment, isSaving: isSaving || assignmentPreview.isBusy,
    error: error ?? assignmentPreview.error, hasConflict: hasConflict || assignmentPreview.issue === "stale", save,
    canSave: Boolean(snapshot.configurationToken) && plan.feasible && (supportsEditable ? assignmentPreview.valid : isAssignmentDraftValid) && !hasConflict && assignmentPreview.issue !== "stale",
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
  let requiredPoolSize = effectivePerPlayer + COMMON_MATCH_COUNT;
  if (supportsTargets) {
    effectivePerPlayer = Math.max(0, ...Object.values(targetsByParticipantId));
    requiredPoolSize = effectivePerPlayer + COMMON_MATCH_COUNT;
  } else if (mode === ASSIGNMENT_MODE.automatic) {
    effectivePerPlayer = Math.max(settings.matchesPerPlayer, settings.sharedMatchesPerPair * Math.max(0, participantCount - 1));
    requiredPoolSize = participantCount * effectivePerPlayer - participantCount * (participantCount - 1) / 2 * settings.sharedMatchesPerPair + COMMON_MATCH_COUNT;
  }
  const feasible = supportsTargets ? poolSize > effectivePerPlayer : poolSize >= requiredPoolSize;
  return {
    ...baseline, ...settings, participantCount, poolSize,
    effectivePerPlayer, requiredPoolSize, relaxedFloor: requiredPoolSize,
    feasible, startable: feasible,
    targetsByParticipantId: supportsTargets ? targetsByParticipantId : undefined,
  };
}
