import * as roomSnapshotUtils from "../../../features/rooms/roomSnapshotAdapter";
import type { RoomSnapshot } from "../../../types/room";

const host = {
  id: "host-1",
  displayName: "Host",
  membershipType: "registered" as const,
  sessionRole: "owner" as const,
  currentDrinkTotal: 0,
};

const expiredGuest = {
  id: "expired-guest-1",
  displayName: "Expired Guest",
  membershipType: "guest" as const,
  sessionRole: "member" as const,
  currentDrinkTotal: 3,
};

const snapshot = {
  sessionId: "room-1",
  joinCode: "ROOM1",
  state: "in_progress" as const,
  commonMatchId: "common-match",
  assignmentMode: "automatic" as const,
  participants: [host, expiredGuest],
  activeRoster: [host],
  matches: [],
  assignments: [
    { participantId: "expired-guest-1", matchId: "match-1" },
  ],
  picks: [],
  assignmentPlan: {
    participantCount: 1,
    poolSize: 0,
    matchesPerPlayer: 0,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 0,
    requiredPoolSize: 0,
    relaxedFloor: 0,
    feasible: true,
    startable: true,
  },
} as unknown as RoomSnapshot;

describe("room snapshot projections", () => {
  it("shows common and assigned matches without removing the room pool, including after reassignment", () => {
    const room = {
      ...snapshot,
      matches: ["unused", "common-match", "match-1"].map((id) => ({
        id,
        sourceProvider: "manual",
        sourceMatchId: null,
        homeTeamName: `${id} home`,
        awayTeamName: `${id} away`,
        kickoffAt: null,
        homeScore: 2,
        awayScore: 1,
      })),
    };

    const game = roomSnapshotUtils.roomSnapshotToGameState(room);
    expect(game.matches.map((match) => match.id)).toEqual(["common-match", "match-1"]);
    expect(game.matches[1]).toMatchObject({ homeGoals: 2, awayGoals: 1 });
    expect(room.matches.map((match) => match.id)).toEqual(["unused", "common-match", "match-1"]);

    const reassigned = roomSnapshotUtils.roomSnapshotToGameState({
      ...room,
      assignments: [{ participantId: host.id, matchId: "unused" }],
    });
    expect(reassigned.matches.map((match) => match.id)).toEqual(["unused", "common-match"]);
  });

  it("selects activeRoster for live lobby consumers with legacy fallback", () => {
    const toActiveRoster = (roomSnapshotUtils as unknown as Record<string, unknown>)
      .roomSnapshotToActiveRoster as
      | ((value: RoomSnapshot) => RoomSnapshot["participants"])
      | undefined;

    expect(toActiveRoster).toBeDefined();
    expect(toActiveRoster?.(snapshot)).toEqual([host]);

    const legacySnapshot = { ...snapshot, activeRoster: undefined };
    expect(toActiveRoster?.(legacySnapshot)).toEqual([host, expiredGuest]);
  });

  it("keeps expired guests in game hydration and settled assignments", () => {
    const gameState = roomSnapshotUtils.roomSnapshotToGameState(snapshot);

    expect(gameState.players).toContainEqual({
      id: "expired-guest-1",
      name: "Expired Guest",
      drinksTaken: 3,
    });
    expect(gameState.playerAssignments["expired-guest-1"]).toEqual([
      "match-1",
    ]);
  });
});
