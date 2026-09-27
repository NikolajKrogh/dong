import type { GuestRoomSnapshot } from "../types/guestRoom";
import type { RoomSnapshot } from "../types/room";
import type { Match, Player } from "../store/store";

export type CompatibleRoomSnapshot = RoomSnapshot | GuestRoomSnapshot;

/**
 * Selects the current, server-derived lobby roster. The fallback is only for a
 * server that has not yet received the additive activeRoster snapshot field.
 */
export const roomSnapshotToActiveRoster = (
  snapshot: CompatibleRoomSnapshot,
) => snapshot.activeRoster ?? snapshot.participants;

export const roomSnapshotToGameState = (snapshot: CompatibleRoomSnapshot) => {
  const players: Player[] = snapshot.participants.map((participant) => ({
    id: participant.id,
    name: participant.displayName,
    drinksTaken: participant.currentDrinkTotal,
  }));

  const matches: Match[] = snapshot.matches.map((match) => ({
    id: match.id,
    homeTeam: match.homeTeamName,
    awayTeam: match.awayTeamName,
    homeGoals: match.homeScore ?? 0,
    awayGoals: match.awayScore ?? 0,
    sourceProvider: match.sourceProvider ?? undefined,
    sourceMatchId: match.sourceMatchId,
    sourceLeagueCode: match.sourceLeagueCode,
    startTime: match.kickoffAt ?? undefined,
    kickoffAt: match.kickoffAt ?? undefined,
  }));

  const playerAssignments = snapshot.participants.reduce<
    Record<string, string[]>
  >((accumulator, participant) => {
    accumulator[participant.id] = snapshot.assignments
      .filter(
        (assignment) =>
          assignment.participantId === participant.id &&
          assignment.matchId !== snapshot.commonMatchId,
      )
      .map((assignment) => assignment.matchId);
    return accumulator;
  }, {});

  return {
    players,
    matches,
    commonMatchId: snapshot.commonMatchId,
    playerAssignments,
  };
};
