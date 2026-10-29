import { getStartGameApiClient } from "../../../features/rooms/startGameClient";

describe("start-game client contract", () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_GAME_API_URL;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GAME_API_URL = "https://game-api.example/";
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_GAME_API_URL;
    else process.env.EXPO_PUBLIC_GAME_API_URL = originalBaseUrl;
  });

  it("uses the action endpoint and returns the actionType acknowledgement", async () => {
    const acknowledgement = { actionType: "start-game", roomId: "room/id", status: "ACCEPTED" };
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => acknowledgement,
    } as Response);

    await expect(getStartGameApiClient().startGame("room/id", "host-token", "replay-key", true))
      .resolves.toEqual(acknowledgement);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://game-api.example/v1/rooms/room%2Fid/actions/start-game",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer host-token", "Idempotency-Key": "replay-key" }),
        body: JSON.stringify({ payload: { relaxConstraints: true } }),
      }),
    );
  });

  it("keeps pending room processing retryable rather than returning an accepted result", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, code: "room_processing_pending" }),
    } as Response);

    await expect(getStartGameApiClient().startGame("room", "host-token", "replay-key"))
      .rejects.toMatchObject({ code: "room_processing_pending" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
