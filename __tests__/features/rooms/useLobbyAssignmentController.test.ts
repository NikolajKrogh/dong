import TestRenderer from "react-test-renderer";
import { renderHook } from "../../../test-utils/render";
import { useLobbyAssignmentController, type RoomLobbyConfigure, type RoomLobbyState } from "../../../features/rooms/useLobbyAssignmentController";
import type { RoomSnapshot } from "../../../types/room";
const participants = ["host", "member", "guest"].map(id => ({ id, displayName: id, membershipType: "registered" as const,
  sessionRole: "member" as const, currentDrinkTotal: 0 }));
const snapshot: RoomSnapshot = {
  sessionId: "room", state: "joinable", joinCode: "ROOM", assignmentPolicyVersion: 2, assignmentMode: "player_picked",
  participants, matches: [], assignments: [{ participantId: "member", matchId: "one" }], commonMatchId: "common",
  picks: [{ participantId: "member", matchId: "one" }],
  assignmentPlan: { targetsByParticipantId: { host: 3, member: 1, guest: 0 }, sharingPolicy: "preference",
    participantCount: 3, poolSize: 4, matchesPerPlayer: 3, sharedMatchesPerPair: 2, effectivePerPlayer: 3,
    requiredPoolSize: 4, relaxedFloor: 4, feasible: true, startable: true },
};
it("shows individual pick progress including a zero target", () => {
  const lobby = { snapshot, state: "joinable" } as RoomLobbyState;
  const { getLatest } = renderHook(() => useLobbyAssignmentController(lobby, {} as RoomLobbyConfigure, "member"));
  expect(getLatest().pickProgress).toEqual({ host: { picked: 0, total: 3 }, member: { picked: 1, total: 1 }, guest: { picked: 0, total: 0 } });
  expect(getLatest().myPicks).toEqual(["one"]);
});
it("caps host allocations individually while retaining release actions", () => {
  const setAssignments = jest.fn();
  const lobby = { snapshot: { ...snapshot, assignmentMode: "host_assigned" }, state: "joinable" } as RoomLobbyState;
  const { getLatest } = renderHook(() => useLobbyAssignmentController(lobby, { setAssignments } as unknown as RoomLobbyConfigure, "host"));
  TestRenderer.act(() => getLatest().toggleAllocation("member", "two"));
  expect(setAssignments).not.toHaveBeenCalled();
  TestRenderer.act(() => getLatest().toggleAllocation("member", "one"));
  expect(setAssignments).toHaveBeenCalledWith([]);
  expect(getLatest().shortParticipants.map(p => p.id)).toEqual(["host"]);
});
