import TestRenderer from "react-test-renderer";
import { renderHook } from "../../../test-utils/render";
import { useRunningGameDraft } from "../../../features/rooms/useRunningGameDraft";
import { getRoomRpcClient } from "../../../features/rooms/roomRpcClient";
import type { RoomSnapshot } from "../../../types/room";

jest.mock("../../../features/rooms/roomRpcClient", () => ({ getRoomRpcClient: jest.fn() }));
const saveConfiguration = jest.fn();
const mockPrepare = jest.fn();
const mockCommit = jest.fn();
jest.mock("../../../features/rooms/roomAssignmentTransport", () => ({
  createRoomAssignmentTransport: () => ({ prepare: mockPrepare, commit: mockCommit }),
}));
const snapshot: RoomSnapshot = {
  sessionId: "room", joinCode: "ROOM", state: "in_progress", commonMatchId: "common",
  assignmentMode: "player_picked", configurationToken: "baseline",
  participants: [{ id: "host", displayName: "Host", membershipType: "registered", sessionRole: "owner", currentDrinkTotal: 2 }],
  matches: ["common", "individual"].map(id => ({ id, sourceProvider: "manual", sourceMatchId: null,
    homeTeamName: id, awayTeamName: "Away", kickoffAt: null, homeScore: 1, awayScore: 0 })),
  assignments: [{ participantId: "host", matchId: "common" }, { participantId: "host", matchId: "individual" }], picks: [],
  assignmentPlan: { participantCount: 1, poolSize: 2, matchesPerPlayer: 1, sharedMatchesPerPair: 0,
    effectivePerPlayer: 1, requiredPoolSize: 2, relaxedFloor: 2, feasible: true, startable: true },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getRoomRpcClient).mockReturnValue({ saveRunningGameConfiguration: saveConfiguration } as unknown as ReturnType<typeof getRoomRpcClient>);
});

it("keeps edits local, retains existing fixtures, and edits player-picked assignments as host", () => {
  const { getLatest } = renderHook(() => useRunningGameDraft(snapshot));
  expect(getLatest().mode).toBe("host_assigned");
  TestRenderer.act(() => getLatest().updateMatches([]));
  expect(getLatest().matches.map(m => m.id)).toEqual(["common", "individual"]);
  expect(saveConfiguration).not.toHaveBeenCalled();
  expect(snapshot.assignments).toHaveLength(2);
});

it("saves new provider fixtures and complete allocations with the baseline token", async () => {
  saveConfiguration.mockResolvedValue(snapshot);
  const { getLatest } = renderHook(() => useRunningGameDraft(snapshot));
  TestRenderer.act(() => {
    getLatest().updateMatches([...getLatest().matches, { id: "provider-new", homeTeam: "Home", awayTeam: "Away",
      homeGoals: 0, awayGoals: 0, kickoffAt: "2026-10-22T15:00:00Z", sourceLeagueCode: "eng.1" }]);
    getLatest().toggleAssignment("host", "individual");
    getLatest().toggleAssignment("host", "provider-new");
  });
  await TestRenderer.act(async () => { await getLatest().save(); });
  expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({ expectedToken: "baseline",
    configuration: expect.objectContaining({ assignmentMode: "host_assigned",
      newMatches: [expect.objectContaining({ clientId: "provider-new", sourceProvider: "espn", sourceMatchId: "provider-new", sourceLeagueCode: "eng.1" })],
      assignments: [{ participantId: "host", matchId: "provider-new" }],
    }),
  }));
});

it("retains drafts and retry identity on network failure, then exposes configuration conflicts", async () => {
  saveConfiguration.mockRejectedValueOnce(new Error("network"))
    .mockRejectedValueOnce(new Error("configuration_conflict"));
  const { getLatest } = renderHook(() => useRunningGameDraft(snapshot));
  await TestRenderer.act(async () => { await getLatest().save(); });
  const firstRequest = saveConfiguration.mock.calls[0][0];
  expect(getLatest().error).toContain("draft has been kept");
  await TestRenderer.act(async () => { await getLatest().save(); });
  expect(saveConfiguration.mock.calls[1][0]).toEqual(firstRequest);
  expect(getLatest().hasConflict).toBe(true);
  expect(getLatest().canSave).toBe(false);
  expect(getLatest().assignments).toEqual([{ participantId: "host", matchId: "individual" }]);
});

it("keeps a zero override when the default changes and clears it on Use default", async () => {
  const v2 = { ...snapshot, capabilities: { perPlayerMatchCounts: true, assignmentPreview: true }, assignmentPolicyVersion: 2 as const,
    participants: snapshot.participants.map(p => ({ ...p, additionalMatchCount: 0 })) };
  const { getLatest } = renderHook(() => useRunningGameDraft(v2));
  TestRenderer.act(() => getLatest().setSettings({ matchesPerPlayer: 3, sharedMatchesPerPair: 0 }));
  expect(getLatest().plan.targetsByParticipantId).toEqual({ host: 0 });
  TestRenderer.act(() => getLatest().setPlayerMatchCount("host", null));
  expect(getLatest().plan.targetsByParticipantId).toEqual({ host: 3 });
});

it.each([
  { supportsTargets: false, mode: "automatic", effective: 2, required: 4 },
  { supportsTargets: false, mode: "host_assigned", effective: 1, required: 2 },
  { supportsTargets: true, mode: "automatic", effective: 1, required: 2 },
  { supportsTargets: true, mode: "host_assigned", effective: 1, required: 2 },
] as const)("preserves pool requirements for $mode with individual targets=$supportsTargets", ({ supportsTargets, mode, effective, required }) => {
  const room: RoomSnapshot = {
    ...snapshot,
    assignmentMode: mode,
    capabilities: { perPlayerMatchCounts: supportsTargets, assignmentPreview: supportsTargets },
    participants: ["host", "second", "third"].map(id => ({
      ...snapshot.participants[0], id, additionalMatchCount: id === "host" ? 0 : null,
    })),
    matches: [...snapshot.matches, ...snapshot.matches.map(match => ({ ...match, id: `extra-${match.id}` }))],
    assignmentPlan: { ...snapshot.assignmentPlan, sharedMatchesPerPair: 1 },
  };
  const { getLatest } = renderHook(() => useRunningGameDraft(room));
  expect(getLatest().plan).toMatchObject({
    effectivePerPlayer: effective, requiredPoolSize: required, relaxedFloor: required,
    feasible: true, startable: true,
  });
});

it("recovers an unknown v2 save outcome before considering changed draft validation", async () => {
  mockPrepare.mockResolvedValue({ proposalId: null, expiresAt: null, assignments: { host: ["individual"] },
    targetsByParticipantId: { host: 1 }, sharingPolicy: "preference", requiresSharingConsent: false, quality: null });
  mockCommit.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(snapshot);
  const v2 = { ...snapshot, assignmentPolicyVersion: 2 as const, capabilities: { perPlayerMatchCounts: true, assignmentPreview: true } };
  const { getLatest } = renderHook(() => useRunningGameDraft(v2));
  await TestRenderer.act(async () => { await getLatest().assignmentPreview.review(); });
  await TestRenderer.act(async () => { expect(await getLatest().save()).toBeNull(); });
  const original = mockCommit.mock.calls[0][0];
  TestRenderer.act(() => getLatest().setPlayerMatchCount("host", 0));
  expect(getLatest().canSave).toBe(false);
  await TestRenderer.act(async () => { expect(await getLatest().save()).toEqual(snapshot); });
  expect(mockCommit.mock.calls[1][0]).toBe(original);
});

it("exposes a rejected v2 fence as a reloadable conflict while retaining edits", async () => {
  mockPrepare.mockResolvedValue({ proposalId: null, expiresAt: null, assignments: { host: ["individual"] },
    targetsByParticipantId: { host: 1 }, sharingPolicy: "preference", requiresSharingConsent: false, quality: null });
  mockCommit.mockReset().mockRejectedValue(new Error("configuration_conflict"));
  const v2 = { ...snapshot, assignmentPolicyVersion: 2 as const, capabilities: { perPlayerMatchCounts: true, assignmentPreview: true } };
  const { getLatest } = renderHook(() => useRunningGameDraft(v2));
  await TestRenderer.act(async () => { await getLatest().assignmentPreview.review(); });
  await TestRenderer.act(async () => { await getLatest().save(); });
  expect(getLatest().hasConflict).toBe(true);
  expect(getLatest().assignments).toEqual([{ participantId: "host", matchId: "individual" }]);
});
