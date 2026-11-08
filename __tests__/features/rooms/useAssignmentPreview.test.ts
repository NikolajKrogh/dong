import { act } from "react-test-renderer";
import { renderHook } from "../../../test-utils/render";
import { useAssignmentPreview } from "../../../features/rooms/useAssignmentPreview";
import type { AssignmentContext } from "../../../features/rooms/roomAssignments";

const mockPrepare = jest.fn();
const mockCommit = jest.fn();
jest.mock("../../../features/rooms/roomAssignmentTransport", () => ({
  createRoomAssignmentTransport: () => ({ prepare: mockPrepare, commit: mockCommit }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepare.mockResolvedValue({ proposalId: "proposal", expiresAt: null, assignments: { a: ["one"] },
    targetsByParticipantId: { a: 1 }, sharingPolicy: "exact", requiresSharingConsent: false, quality: null });
  mockCommit.mockResolvedValue({ sessionId: "room" });
});

function fixture() {
  let context: AssignmentContext = { revision: "revision", expectedToken: "token", targetsByParticipantId: { a: 1 },
    configuration: { assignmentPolicyVersion: 2, assignmentMode: "automatic", matchesPerPlayer: 1,
      sharedMatchesPerPair: 1, playerMatchCounts: {}, newMatches: [], assignments: [] } };
  let pool = ["one", "two"];
  const hook = renderHook(() => useAssignmentPreview("room", "start", context, { editable: true, poolIds: pool }));
  return { ...hook, change: (next: AssignmentContext) => { context = next; }, context: () => context,
    removeFirst: () => { pool = ["two"]; } };
}

it("starts Players pick directly with the latest picks and no proposal", async () => {
  let context: AssignmentContext = { revision: "first", expectedToken: "first", targetsByParticipantId: { a: 1 },
    configuration: { assignmentPolicyVersion: 2, assignmentMode: "player_picked", matchesPerPlayer: 1,
      sharedMatchesPerPair: 1, playerMatchCounts: {}, newMatches: [], assignments: [{ participantId: "a", matchId: "one" }] } };
  const hook = renderHook(() => useAssignmentPreview("room", "start", context));
  context = { ...context, revision: "second", expectedToken: "second",
    configuration: { ...context.configuration, assignments: [{ participantId: "a", matchId: "two" }] } };
  act(() => hook.rerender());
  await act(async () => { await hook.getLatest().commit(); });
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(mockCommit).toHaveBeenCalledWith(expect.objectContaining({ proposalId: null, context }));
  expect(mockCommit.mock.calls[0][0]).not.toHaveProperty("assignmentOverrides");
});
it("generates, allows over-selection, and commits the edited choices without changing Automatic mode", async () => {
  const hook = fixture();
  await act(async () => { await hook.getLatest().review(); });
  expect(hook.getLatest().assignments).toEqual([{ participantId: "a", matchId: "one" }]);
  act(() => hook.getLatest().toggleAssignment("a", "two"));
  expect(hook.getLatest().valid).toBe(false);
  act(() => hook.getLatest().toggleAssignment("a", "one"));
  expect(hook.getLatest().valid).toBe(true);
  await act(async () => { await hook.getLatest().commit(); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  expect(mockCommit).toHaveBeenCalledWith(expect.objectContaining({ proposalId: null,
    assignmentOverrides: [{ participantId: "a", matchId: "two" }],
    context: expect.objectContaining({ configuration: expect.objectContaining({ assignmentMode: "automatic" }) }) }));
});

it("preserves selections on target changes, drops removed pool entries, and supports zero targets", async () => {
  const hook = fixture();
  await act(async () => { await hook.getLatest().review(); });
  hook.change({ ...hook.context(), targetsByParticipantId: { a: 0 } });
  act(() => hook.rerender());
  expect(hook.getLatest().assignments).toHaveLength(1);
  expect(hook.getLatest().valid).toBe(false);
  hook.removeFirst();
  act(() => hook.rerender());
  expect(hook.getLatest().assignments).toEqual([]);
  expect(hook.getLatest().valid).toBe(true);
});

it("does not replace picks with a stale generation response", async () => {
  const hook = fixture();
  let resolve!: (value: unknown) => void;
  mockPrepare.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  let request!: Promise<void>;
  await act(async () => { request = hook.getLatest().review(); await Promise.resolve(); });
  hook.change({ ...hook.context(), revision: "changed" });
  act(() => hook.rerender());
  await act(async () => { resolve({ proposalId: "old", assignments: { a: ["one"] } }); await request; });
  expect(hook.getLatest().issue).toBe("stale");
  expect(hook.getLatest().assignments).toEqual([]);
});

it("keeps the draft and freezes editing until an uncertain commit is retried", async () => {
  const hook = fixture();
  await act(async () => { await hook.getLatest().review(); });
  mockCommit.mockRejectedValueOnce(new Error("network failed"));
  await act(async () => { await hook.getLatest().commit(); });
  expect(hook.getLatest().recoveryRequired).toBe(true);
  act(() => hook.getLatest().toggleAssignment("a", "two"));
  expect(hook.getLatest().assignments).toHaveLength(1);
  const first = mockCommit.mock.calls[0][0];
  await act(async () => { await hook.getLatest().commit(); });
  expect(mockCommit.mock.calls[1][0]).toBe(first);
  expect(hook.getLatest().recoveryRequired).toBe(false);
});
