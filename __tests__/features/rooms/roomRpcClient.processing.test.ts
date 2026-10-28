import { createGuestRoomRpcClient, createRoomRpcClient } from "../../../features/rooms/roomRpcClient";
const pending = { ok: false, code: "room_processing_pending", retryAfterSeconds: 1 };
const input = { sessionId: "room", participantId: "player", matchIds: ["match"], idempotencyKey: "original-key" };

describe("committed room processing continuation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("retries a registered mutation twice with the original key and business payload", async () => {
    const responses = jest.fn().mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: { sessionId: "room", replayed: false }, error: null });
    const rpc = jest.fn(() => ({ overrideTypes: responses }));
    const task = createRoomRpcClient({ rpc } as never).reassignParticipantMatches(input);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(task).resolves.toMatchObject({ sessionId: "room" });
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls).toEqual(Array.from({ length: 3 }, () => ["reassign_participant_matches", { session_id: "room", participant_id: "player", match_ids: ["match"], idempotency_key: "original-key" }]));
  });
  it("does not parse a third pending result as terminal success", async () => {
    const rpc = jest.fn(() => ({ overrideTypes: jest.fn().mockResolvedValue({ data: pending, error: null }) }));
    const task = createRoomRpcClient({ rpc } as never).reassignParticipantMatches(input);
    const rejection = expect(task).rejects.toMatchObject({ code: "room_processing_pending" });
    await jest.advanceTimersByTimeAsync(2000);
    await rejection;
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("retries a guest departure without changing its token or treating pending as confirmation", async () => {
    const invoke = jest.fn().mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: { ok: true, status: "confirmed", sessionId: "room" }, error: null });
    const task = createGuestRoomRpcClient({ functions: { invoke } } as never).leaveRoomAsGuest("original-token");
    await jest.advanceTimersByTimeAsync(1000);
    await expect(task).resolves.toMatchObject({ status: "confirmed" });
    expect(invoke.mock.calls[0]).toEqual(invoke.mock.calls[1]);
  });
  it("preserves stale configuration conflicts without rebasing or retrying", async () => {
    const rpc = jest.fn(() => ({ overrideTypes: jest.fn().mockResolvedValue({ data: null, error: { message: "configuration_conflict" } }) }));
    await expect(createRoomRpcClient({ rpc } as never).saveRunningGameConfiguration({ sessionId: "room", configuration: {} as never, expectedToken: "stale", idempotencyKey: "original-key" })).rejects.toMatchObject({ message: "configuration_conflict" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
