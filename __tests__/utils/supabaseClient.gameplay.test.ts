import {
  GameplayRpcError,
  type GameplayCommandResult,
} from "../../types/room";
import {
  createGuestRoomRpcClient,
  createProviderScoreRefreshClient,
  createRoomRpcClient,
} from "../../utils/supabaseClient";

type FakeResult = {
  data: GameplayCommandResult | null;
  error: { message: string } | null;
};

const fakeClient = (result: FakeResult) => {
  const rpc = jest.fn(() => ({
    overrideTypes: jest.fn().mockResolvedValue(result),
  }));
  return { client: { rpc } as never, rpc };
};

const result: GameplayCommandResult = {
  sessionId: "session-1",
  sequenceNumber: 9,
  eventId: "event-1",
  replayed: false,
  matchId: "match-1",
  homeScore: 1,
  awayScore: 0,
};

describe("server-authoritative gameplay RPC clients", () => {
  it("sends only the room ID and UUID key to the authenticated Edge Function", async () => {
    const response = {
      sessionId: "session-1",
      requestId: "00000000-0000-4000-8000-000000000001",
      status: "not_due" as const,
      refreshedAt: null,
      results: [],
      warnings: [],
    };
    const invoke = jest.fn().mockResolvedValue({ data: response, error: null });
    const client = {
      functions: { invoke },
    } as never;

    await expect(
      createProviderScoreRefreshClient(client).refreshProviderScores(
        "session-1",
        "00000000-0000-4000-8000-000000000001",
      ),
    ).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith("refresh-provider-scores", {
      body: { sessionId: "session-1" },
      headers: {
        "Idempotency-Key": "00000000-0000-4000-8000-000000000001",
      },
    });
  });

  it("serializes a registered manual score command and preserves the result", async () => {
    const { client, rpc } = fakeClient({ data: result, error: null });
    const roomClient = createRoomRpcClient(client);

    await expect(
      roomClient.changeManualScore({
        sessionId: "session-1",
        matchId: "match-1",
        team: "home",
        deltaGoals: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith("change_manual_score", {
      session_id: "session-1",
      match_id: "match-1",
      team: "home",
      delta_goals: 1,
      idempotency_key: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("serializes guest drink changes without exposing a participant actor override", async () => {
    const { client, rpc } = fakeClient({
      data: { ...result, participantId: "participant-1", currentDrinkTotal: 0.5 },
      error: null,
    });
    const guestClient = createGuestRoomRpcClient(client);

    await guestClient.changeParticipantDrinkAsGuest({
      guestToken: "guest-token",
      participantId: "participant-1",
      deltaHalfDrinks: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });
    expect(rpc).toHaveBeenCalledWith("change_participant_drink_as_guest", {
      guest_token: "guest-token",
      participant_id: "participant-1",
      delta_half_drinks: 1,
      idempotency_key: "00000000-0000-4000-8000-000000000002",
    });
  });

  it.each([
    "not_room_participant",
    "target_inactive",
    "provider_score_required",
    "invalid_room_state",
    "idempotency_conflict",
  ])("maps stable server error %s", async (code) => {
    const { client } = fakeClient({ data: null, error: { message: code } });
    const roomClient = createRoomRpcClient(client);

    await expect(
      roomClient.changeParticipantDrink({
        sessionId: "session-1",
        participantId: "participant-1",
        deltaHalfDrinks: 1,
        idempotencyKey: "00000000-0000-4000-8000-000000000003",
      }),
    ).rejects.toMatchObject({ name: "GameplayRpcError", code });
  });

  it("leaves transport failures untouched for uncertain-response retry handling", async () => {
    const original = { message: "network request failed" };
    const { client } = fakeClient({ data: null, error: original });
    const roomClient = createRoomRpcClient(client);

    await expect(
      roomClient.changeManualScore({
        sessionId: "session-1",
        matchId: "match-1",
        team: "away",
        deltaGoals: -1,
        idempotencyKey: "00000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toBe(original);
    expect(new GameplayRpcError("not_host", "message")).toBeInstanceOf(Error);
  });
});
