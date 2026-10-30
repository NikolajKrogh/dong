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
  const [assignments, setAssignments] = useState(() => snapshot.assignments.filter(a => a.matchId !== snapshot.commonMatchId));
  const [playerMatchCounts, setPlayerMatchCounts] = useState<Record<string, number>>(() => Object.fromEntries(
    roomSnapshotToActiveRoster(snapshot).filter(p => p.additionalMatchCount != null).map(p => [p.id, p.additionalMatchCount!]),
  ));
  const supportsTargets = snapshot.capabilities?.perPlayerMatchCounts === true;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const participants = roomSnapshotToActiveRoster(snapshot);
  const fixedMatchIds = snapshot.matches.map(match => match.id);
  const fixedIds = new Set(fixedMatchIds);
  const activeIds = new Set(participants.map(p => p.id));
  const targets = Object.fromEntries(participants.map(p => [p.id, playerMatchCounts[p.id] ?? settings.matchesPerPlayer]));
  const plan = buildDraftAssignmentPlan(snapshot.assignmentPlan, settings, mode, targets, participants.length, matches.length, supportsTargets);
  const matchIds = new Set(matches.map(match => match.id));
  const validAssignments = mode === "automatic" || participants.every(participant => {
    const selectedCount = assignments.filter(assignment =>
      assignment.participantId === participant.id && matchIds.has(assignment.matchId),
    ).length;
    const target = supportsTargets ? targets[participant.id] : plan.effectivePerPlayer;
    return selectedCount === target;
  });
  const configuration: RunningGameConfiguration = {
    assignmentMode: mode, ...settings,
    ...(supportsTargets ? { assignmentPolicyVersion: 2 as const, playerMatchCounts } : {}),
    newMatches: matches.filter(match => !fixedIds.has(match.id)).map(match => ({ ...toAddRequest(match), clientId: match.id })),
    assignments: assignments.filter(a => activeIds.has(a.participantId)),
  };
  const assignmentPreview = useAssignmentPreview(snapshot.sessionId, "running_save", {
    revision: currentSnapshot.configurationToken ?? "", expectedToken: snapshot.configurationToken ?? "",
    targetsByParticipantId: targets, configuration,
  });

  function updateMatches(next: Match[]): void {
    if (inFlight.current) return;
    const byId = new Map(next.map(match => [match.id, match]));
    for (const match of snapshot.matches) byId.set(match.id, toDisplayMatch(match));
    setMatches([...byId.values()]);
    setAssignments(previous => previous.filter(a => byId.has(a.matchId)));
  }

  function toggleAssignment(participantId: string, matchId: string): void {
    if (isSaving || !activeIds.has(participantId) || matchId === snapshot.commonMatchId) return;
    setAssignments(previous => {
      const exists = previous.some(a => a.participantId === participantId && a.matchId === matchId);
      if (exists) return previous.filter(a => a.participantId !== participantId || a.matchId !== matchId);
      const target = supportsTargets ? targets[participantId] : plan.effectivePerPlayer;
      if (previous.filter(a => a.participantId === participantId).length >= target) return previous;
      return [...previous, { participantId, matchId }];
    });
  }

  async function save(acceptRelaxedSharing = false): Promise<RoomSnapshot | null> {
    if (inFlight.current || !snapshot.configurationToken) return null;
    if (supportsTargets) return assignmentPreview.commit(acceptRelaxedSharing);
    if (!plan.feasible || !validAssignments) return null;
    const fingerprint = JSON.stringify(configuration);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, key: generateIdempotencyKey() };
    }
    inFlight.current = true;
    setIsSaving(true);
    setError(null);
    try {
      return await getRoomRpcClient().saveRunningGameConfiguration({
        sessionId: snapshot.sessionId, configuration, expectedToken: snapshot.configurationToken,
        idempotencyKey: request.current.key,
      });
    } catch (failure) {
      const conflict = (failure as { message?: string })?.message === "configuration_conflict";
      setHasConflict(conflict);
      setError(conflict
        ? "The room configuration changed while you were editing. Your draft has been kept. Reload the room to start again."
        : "Changes could not be saved. Check your connection and try again. Your draft has been kept.");
      return null;
    } finally {
      inFlight.current = false;
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
    participants: supportsTargets ? participants.map(p => ({ ...p, additionalMatchCount: playerMatchCounts[p.id] ?? null })) : participants,
    fixedMatchIds,
    assignments, toggleAssignment, isSaving: isSaving || assignmentPreview.isBusy,
    error: error ?? assignmentPreview.error, hasConflict: hasConflict || assignmentPreview.issue === "stale", save,
    canSave: Boolean(snapshot.configurationToken) && plan.feasible && validAssignments && !hasConflict && assignmentPreview.issue !== "stale",
  };
}

function buildDraftAssignmentPlan(
  baseline: RoomSnapshot["assignmentPlan"],
  settings: Pick<RunningGameConfiguration, "matchesPerPlayer" | "sharedMatchesPerPair">,
  mode: RunningGameConfiguration["assignmentMode"],
  targets: Record<string, number>,
  participantCount: number,
  poolSize: number,
  supportsTargets: boolean,
): RoomSnapshot["assignmentPlan"] {
  let effectivePerPlayer = settings.matchesPerPlayer;
  let requiredPoolSize = effectivePerPlayer + 1;
  if (supportsTargets) {
    effectivePerPlayer = Math.max(0, ...Object.values(targets));
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
    targetsByParticipantId: supportsTargets ? targets : undefined,
  };
}
