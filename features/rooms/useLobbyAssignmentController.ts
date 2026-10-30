import {
  useCallback,
  useMemo,
  useState
} from "react";
import type { AssignmentMode } from "../../types/room";
import {
  type SelectableMatch
} from "../game-setup/SelectableMatchList";
import {
  roomSnapshotToActiveRoster
} from "./roomSnapshotAdapter";
import { useRoomConfigure } from "./useRoomConfigure";
import { useRoomLobby } from "./useRoomLobby";

export type RoomLobbyState = ReturnType<typeof useRoomLobby>;

export type RoomLobbySnapshot = NonNullable<RoomLobbyState["snapshot"]>;

export type RoomLobbyConfigure = ReturnType<typeof useRoomConfigure>;

type LobbyPlan = RoomLobbySnapshot["assignmentPlan"];

type LobbyPickProgress = Record<string, { picked: number; total: number }>;

const EMPTY_ASSIGNMENT_PLAN: LobbyPlan = {
  participantCount: 0,
  poolSize: 0,
  matchesPerPlayer: 0,
  sharedMatchesPerPair: 0,
  effectivePerPlayer: 0,
  requiredPoolSize: 0,
  relaxedFloor: 0,
  feasible: false,
  startable: false,
};

export function useLobbyAssignmentController(
  lobby: RoomLobbyState,
  configure: RoomLobbyConfigure,
  participantId: string,
) {
  const snapshot = lobby.snapshot;
  const [pendingModeSwitch, setPendingModeSwitch] = useState<AssignmentMode | null>(null);
  const plan = snapshot?.assignmentPlan ?? EMPTY_ASSIGNMENT_PLAN;
  const assignmentMode = snapshot?.assignmentMode ?? "automatic";
  const participants = useMemo(
    () => snapshot ? roomSnapshotToActiveRoster(snapshot) : [],
    [snapshot],
  );
  const assignments = useMemo(() => snapshot?.assignments ?? [], [snapshot?.assignments]);
  const commonMatchId = snapshot?.commonMatchId ?? null;

  const handleSelectMode = useCallback((mode: AssignmentMode) => {
    if (mode === assignmentMode) return;
    if ((snapshot?.assignments.length ?? 0) > 0) {
      setPendingModeSwitch(mode);
      return;
    }
    void configure.setAssignmentMode(mode);
  }, [assignmentMode, configure, snapshot?.assignments.length]);

  const handleConfirmModeSwitch = useCallback(() => {
    if (pendingModeSwitch) {
      void configure.setAssignmentMode(pendingModeSwitch);
    }
    setPendingModeSwitch(null);
  }, [configure, pendingModeSwitch]);
  const handleCancelModeSwitch = useCallback(() => setPendingModeSwitch(null), []);

  const automaticMinimum = plan.sharedMatchesPerPair * Math.max(participants.length - 1, 0);
  const modeSwitchRaisesMinimum = pendingModeSwitch === "automatic" &&
    !plan.targetsByParticipantId &&
    automaticMinimum > plan.matchesPerPlayer;

  const picks = useMemo(() => snapshot?.picks ?? [], [snapshot?.picks]);
  const isPlayerPicked = assignmentMode === "player_picked";
  const canPick = isPlayerPicked && lobby.state === "joinable";
  const pickableMatches = useMemo<SelectableMatch[]>(
    () => (snapshot?.matches ?? [])
      .filter((match) => match.id !== commonMatchId)
      .map((match) => ({
        id: match.id,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        startTime: match.kickoffAt ?? undefined,
      })),
    [snapshot?.matches, commonMatchId],
  );
  const poolAsSelectable = useMemo<SelectableMatch[]>(
    () => (snapshot?.matches ?? []).map((match) => ({
      id: match.id,
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      startTime: match.kickoffAt ?? undefined,
    })),
    [snapshot?.matches],
  );
  const myPicks = useMemo(
    () => participantId
      ? picks.filter((pick) => pick.participantId === participantId)
        .map((pick) => pick.matchId)
      : [],
    [participantId, picks],
  );
  const pickProgress = useMemo<LobbyPickProgress | undefined>(() => {
    if (!isPlayerPicked) return undefined;
    return participants.reduce<LobbyPickProgress>((accumulator, participant) => {
      accumulator[participant.id] = {
        picked: picks.filter((pick) => pick.participantId === participant.id).length,
        total: plan.targetsByParticipantId?.[participant.id] ?? plan.matchesPerPlayer,
      };
      return accumulator;
    }, {});
  }, [isPlayerPicked, participants, picks, plan.matchesPerPlayer, plan.targetsByParticipantId]);

  const additionalMatchIdsFor = useCallback(
    (participantId: string) => assignments
      .filter((assignment) => assignment.participantId === participantId && assignment.matchId !== commonMatchId)
      .map((assignment) => assignment.matchId),
    [assignments, commonMatchId],
  );
  const shortParticipants = participants.filter(
    (participant) => additionalMatchIdsFor(participant.id).length < (plan.targetsByParticipantId?.[participant.id] ?? plan.matchesPerPlayer),
  );
  const toggleAllocation = useCallback((participantId: string, matchId: string) => {
    const activeAssignments = assignments.filter((assignment) =>
      participants.some((participant) => participant.id === assignment.participantId),
    );
    const exists = activeAssignments.some((assignment) =>
      assignment.participantId === participantId && assignment.matchId === matchId,
    );
    if (!exists && additionalMatchIdsFor(participantId).length >= (plan.targetsByParticipantId?.[participantId] ?? plan.matchesPerPlayer)) return;
    const next = exists
      ? activeAssignments.filter((assignment) =>
        assignment.participantId !== participantId || assignment.matchId !== matchId,
      )
      : [...activeAssignments, { participantId, matchId }];
    void configure.setAssignments(next);
  }, [assignments, configure, participants, additionalMatchIdsFor, plan.targetsByParticipantId, plan.matchesPerPlayer]);

  return {
    assignmentMode,
    participantId,
    automaticMinimum,
    canPick,
    commonMatchId,
    handleCancelModeSwitch,
    handleConfirmModeSwitch,
    handleSelectMode,
    modeSwitchRaisesMinimum,
    myPicks,
    participants,
    pendingModeSwitch,
    pickProgress,
    picks,
    pickableMatches,
    plan,
    poolAsSelectable,
    shortParticipants,
    additionalMatchIdsFor,
    toggleAllocation,
  };
}
