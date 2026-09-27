import * as roomSnapshotUtils from "../../utils/roomSnapshot";
import type { RoomSnapshot } from "../../types/room";

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
