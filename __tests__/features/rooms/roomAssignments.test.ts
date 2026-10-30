import { createRoomAssignments, type AssignmentContext, type AssignmentTransport, type PreparedAssignmentPreview } from "../../../features/rooms/roomAssignments";

const prepared: PreparedAssignmentPreview = {
  proposalId: "proposal", expiresAt: "2099-01-01T00:00:00Z", assignments: { a: ["one"] },
  targetsByParticipantId: { a: 1 }, sharingPolicy: "exact", requiresSharingConsent: false,
  quality: null,
};
function fixture() {
  let context: AssignmentContext = { revision: "one", expectedToken: "token", configuration: {
    assignmentMode: "automatic", assignmentPolicyVersion: 2, matchesPerPlayer: 1,
    sharedMatchesPerPair: 0, playerMatchCounts: {}, assignments: [], newMatches: [],
  } };
  const transport: AssignmentTransport = {
    prepare: jest.fn(async () => prepared),
    commit: jest.fn(async () => ({ sessionId: "room" }) as never),
  };
  const controller = createRoomAssignments("room", "start", () => context, transport, { newKey: () => "key", wait: async () => {} });
  return { controller, transport, change: () => { context = { ...context, revision: "two" }; } };
}

it("coalesces duplicate preview requests and hides wire identity", async () => {
  const { controller, transport } = fixture();
  const [first, second] = await Promise.all([controller.preview(), controller.preview()]);
  expect(first).toBe(second);
  expect(transport.prepare).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveProperty("proposalId");
  expect(Object.isFrozen(first)).toBe(true);
});
it("rejects stale drafts before committing", async () => {
  const { controller, transport, change } = fixture();
  const preview = await controller.preview();
  change();
  expect(await controller.commit(preview)).toMatchObject({ issue: "stale" });
  expect(transport.commit).not.toHaveBeenCalled();
});
it("binds relaxation consent to the reviewed preview", async () => {
  const { controller, transport } = fixture();
  jest.mocked(transport.prepare).mockResolvedValue({ ...prepared, sharingPolicy: "relaxed", requiresSharingConsent: true });
  const preview = await controller.preview();
  expect(await controller.commit(preview)).toMatchObject({ issue: "confirmation_required" });
  expect(transport.commit).not.toHaveBeenCalled();
  expect(await controller.commit(preview, { acceptRelaxedSharing: true })).toMatchObject({ sessionId: "room" });
});
it("replays a frozen request after a lost response even when the draft changed", async () => {
  const { controller, transport, change } = fixture();
  jest.mocked(transport.commit).mockRejectedValueOnce(new Error("network failed"));
  const preview = await controller.preview();
  expect(await controller.commit(preview)).toMatchObject({ issue: "unavailable" });
  const first = jest.mocked(transport.commit).mock.calls[0][0];
  change();
  expect(await controller.commit(preview)).toMatchObject({ sessionId: "room" });
  expect(jest.mocked(transport.commit).mock.calls[1][0]).toBe(first);
  expect(first.idempotencyKey).toBe("key");
});
it("bounds server-pending retries to two and retains commit identity", async () => {
  const { controller, transport } = fixture();
  jest.mocked(transport.prepare).mockResolvedValue({ issue: "preview_pending", retryAfterSeconds: 0 });
  expect(await controller.preview()).toMatchObject({ issue: "busy" });
  expect(transport.prepare).toHaveBeenCalledTimes(3);
});
it("discards a response for an older draft", async () => {
  const { controller, transport, change } = fixture();
  let finish!: (value: PreparedAssignmentPreview) => void;
  jest.mocked(transport.prepare).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = controller.preview();
  await Promise.resolve();
  change();
  finish(prepared);
  expect(await pending).toMatchObject({ issue: "stale" });
});

it("rejects expired handles before a first commit", async () => {
  const { controller, transport } = fixture();
  jest.mocked(transport.prepare).mockResolvedValue({ ...prepared, expiresAt: "2000-01-01T00:00:00Z" });
  expect(await controller.commit(await controller.preview())).toEqual({ issue: "expired" });
  expect(transport.commit).not.toHaveBeenCalled();
});

it("does not replay a rejected request after host authority changes", async () => {
  const { controller, transport } = fixture();
  jest.mocked(transport.commit).mockRejectedValueOnce(new Error("not_host"));
  const reviewed = await controller.preview();
  expect(await controller.commit(reviewed)).toEqual({ issue: "not_host" });
});

it("retries processing with the identical accepted business request", async () => {
  const { controller, transport } = fixture();
  jest.mocked(transport.commit).mockResolvedValueOnce({ code: "room_processing_pending", retryAfterSeconds: 0 });
  const reviewed = await controller.preview();
  expect(await controller.commit(reviewed)).toMatchObject({ sessionId: "room" });
  expect(jest.mocked(transport.commit).mock.calls[0][0]).toBe(jest.mocked(transport.commit).mock.calls[1][0]);
});
