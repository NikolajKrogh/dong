import { useRef, useState } from "react";
import type { Match } from "../../store/gameStore";
import type { RoomSnapshot, RunningGameConfiguration } from "../../types/room";
import { getRoomRpcClient } from "./roomRpcClient";
import { generateIdempotencyKey } from "../../utils/idempotencyKey";
import { toAddRequest, toDisplayMatch } from "./useRoomMatchPool";
import { roomSnapshotToActiveRoster } from "./roomSnapshotAdapter";

export function useRunningGameDraft(snapshot: RoomSnapshot) {
  const [matches, setMatches] = useState(() => snapshot.matches.map(toDisplayMatch));
  const [mode, setMode] = useState<RunningGameConfiguration["assignmentMode"]>(
    snapshot.assignmentMode === "automatic" ? "automatic" : "host_assigned",
  );
  const [settings, setSettings] = useState({
    matchesPerPlayer: snapshot.assignmentPlan.matchesPerPlayer,
    sharedMatchesPerPair: snapshot.assignmentPlan.sharedMatchesPerPair,
  });
  const [assignments, setAssignments] = useState(() => snapshot.assignments.filter(a => a.matchId !== snapshot.commonMatchId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const participants = roomSnapshotToActiveRoster(snapshot);
  const fixedMatchIds = snapshot.matches.map(match => match.id);
  const fixedIds = new Set(fixedMatchIds);
  const activeIds = new Set(participants.map(p => p.id));
  const n = participants.length;
  const effective = mode === "automatic"
    ? Math.max(settings.matchesPerPlayer, settings.sharedMatchesPerPair * Math.max(0, n - 1))
    : settings.matchesPerPlayer;
  const required = mode === "automatic"
    ? n * effective - n * (n - 1) / 2 * settings.sharedMatchesPerPair + 1
    : effective + 1;
  const plan = {
    ...snapshot.assignmentPlan, ...settings, participantCount: n, poolSize: matches.length,
    effectivePerPlayer: effective, requiredPoolSize: required, relaxedFloor: required,
    feasible: matches.length >= required, startable: matches.length >= required,
  };
  const validAssignments = mode === "automatic" || participants.every(p =>
    assignments.filter(a => a.participantId === p.id && matches.some(m => m.id === a.matchId)).length === effective,
  );

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
      return [...previous, { participantId, matchId }];
    });
  }

  async function save(): Promise<RoomSnapshot | null> {
    if (inFlight.current || !plan.feasible || !validAssignments || !snapshot.configurationToken) return null;
    const configuration: RunningGameConfiguration = {
      assignmentMode: mode, ...settings,
      newMatches: matches.filter(match => !fixedIds.has(match.id))
        .map(match => ({ ...toAddRequest(match), clientId: match.id })),
      assignments: assignments.filter(a => activeIds.has(a.participantId)),
    };
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

  return {
    matches, updateMatches, mode, setMode, settings, setSettings, plan, participants, fixedMatchIds,
    assignments, toggleAssignment, isSaving, error, hasConflict, save,
    canSave: Boolean(snapshot.configurationToken) && plan.feasible && validAssignments && !hasConflict,
  };
}
