import {
  ReassignmentRpcError,
  type ReassignParticipantMatchesResponse,
} from "../../types/room";
import { createRoomRpcClient } from "../../utils/supabaseClient";

type FakeRpcResult = {
  data: ReassignParticipantMatchesResponse | null;
  error: { message: string } | null;
};

const createFakeClient = (result: FakeRpcResult) => {
  const rpc = jest.fn(() => ({
    overrideTypes: jest.fn().mockResolvedValue(result),
  }));

  return { client: { rpc } as never, rpc };
};

describe("reassignParticipantMatches", () => {
  it.each([
    ["not_authenticated"],
    ["room_not_found"],
    ["not_host"],
    ["host_participant_not_found"],
    ["invalid_reassignment_input"],
    ["game_not_in_progress"],
    ["participant_not_in_room"],
    ["cannot_reassign_common_match"],
    ["match_not_in_room_pool"],
    ["assignment_count_mismatch"],
    ["idempotency_key_reused"],
  ])("maps %s to a typed error", async (code) => {
    const { client } = createFakeClient({
      data: null,
      error: { message: code },
    });
    const rpcClient = createRoomRpcClient(client);

    await expect(
      rpcClient.reassignParticipantMatches({
        sessionId: "session-1",
        participantId: "participant-1",
        matchIds: ["match-2"],
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toMatchObject({
      name: "ReassignmentRpcError",
      code,
    });
  });

  it("round-trips the successful response", async () => {
    const response: ReassignParticipantMatchesResponse = {
      sessionId: "session-1",
      participantId: "participant-1",
      addedMatchIds: ["match-2"],
      removedMatchIds: ["match-1"],
      matchIds: ["match-2"],
      sequenceNumber: 42,
    };
    const { client, rpc } = createFakeClient({ data: response, error: null });
    const rpcClient = createRoomRpcClient(client);

    await expect(
      rpcClient.reassignParticipantMatches({
        sessionId: "session-1",
        participantId: "participant-1",
        matchIds: ["match-2"],
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toEqual(response);
    expect(rpc).toHaveBeenCalledWith("reassign_participant_matches", {
      session_id: "session-1",
      participant_id: "participant-1",
      match_ids: ["match-2"],
      idempotency_key: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("leaves unknown Postgres errors untouched", async () => {
    const original = { message: "connection refused" };
    const { client } = createFakeClient({ data: null, error: original });
    const rpcClient = createRoomRpcClient(client);

    await expect(
      rpcClient.reassignParticipantMatches({
        sessionId: "session-1",
        participantId: "participant-1",
        matchIds: [],
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toBe(original);
    expect(new ReassignmentRpcError("not_host", "message")).toBeInstanceOf(
      Error,
    );
  });
});
