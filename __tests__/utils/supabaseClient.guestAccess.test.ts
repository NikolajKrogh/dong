import { createGuestRoomRpcClient } from "../../utils/supabaseClient";
import { getGuestRoomErrorMessage, GuestRoomAccessError } from "../../utils/guestRoom";

const request = { joinCode: "ROOM42", guestName: "Ada", guestToken: "secret-token" };

const fakeClient = (data: unknown, error: unknown = null) => {
  const rpc = jest.fn().mockResolvedValue({ data, error });
  return { client: { functions: { invoke: rpc } } as never, rpc };
};

describe("guest access RPC envelopes", () => {
  it("accepts a joined identity and expiry without changing response fields", async () => {
    const data = {
      participantId: "guest-1", sessionId: "room-1", guestToken: request.guestToken,
      joinCode: request.joinCode, displayName: request.guestName,
      grantExpiresAt: "2026-09-22T00:00:00Z", snapshot: { sessionId: "room-1" },
    };
    const { client, rpc } = fakeClient(data);
    await expect(createGuestRoomRpcClient(client).joinRoomAsGuest(request)).resolves.toEqual(data);
    expect(rpc).toHaveBeenCalledWith("guest-room-access", { body: { operation: "join_room_as_guest", args: {
      join_code: request.joinCode, guest_name: request.guestName, guest_token: request.guestToken,
    } } });
  });

  it.each(["room_unavailable", "rate_limited"])("converts the %s envelope into a safe code", async code => {
    const { client } = fakeClient({ ok: false, code, retryAfterSeconds: 20 });
    await expect(createGuestRoomRpcClient(client).joinRoomAsGuest(request)).rejects.toThrow(code);
  });

  it("keeps bounded retry timing without exposing the submitted code", async () => {
    const { client } = fakeClient({ ok: false, code: "rate_limited", retryAfterSeconds: 9999 });
    try {
      await createGuestRoomRpcClient(client).joinRoomAsGuest(request);
      throw new Error("join unexpectedly succeeded");
    } catch (error) {
      expect(error).toBeInstanceOf(GuestRoomAccessError);
      expect((error as GuestRoomAccessError).retryAfterSeconds).toBe(300);
      expect(getGuestRoomErrorMessage(error)).toBe("Too many attempts. Try again in 300 seconds.");
      expect(String(error)).not.toContain(request.joinCode);
    }
  });

  it("does not leak request secrets through a server error", async () => {
    const { client } = fakeClient(null, { message: `failure for ${request.guestToken} in ${request.joinCode}` });
    await expect(createGuestRoomRpcClient(client).joinRoomAsGuest(request)).rejects.toThrow("unknown_error");
  });

  it("keeps confirmed leave distinct from not-permitted leave", async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: { ok: true, status: "confirmed" }, error: null })
      .mockResolvedValueOnce({ data: { ok: false, code: "not_permitted" }, error: null });
    const guest = createGuestRoomRpcClient({ functions: { invoke: rpc } } as never);
    await expect(guest.leaveRoomAsGuest(request.guestToken)).resolves.toEqual({ ok: true, status: "confirmed" });
    await expect(guest.leaveRoomAsGuest(request.guestToken)).resolves.toEqual({ ok: false, code: "not_permitted" });
  });

  it("parses rotation confirmation without echoing the replacement bearer", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: {
      ok: true, participantId: "guest-1", grantExpiresAt: "2026-09-22T00:00:00Z", replayed: false,
    }, error: null });
    const guest = createGuestRoomRpcClient({ functions: { invoke: rpc } } as never);
    const result = await guest.rotateGuestRoomGrant(request.guestToken, "replacement-secret", "00000000-0000-4000-8000-000000000001");
    expect(result).toEqual({ ok: true, participantId: "guest-1", grantExpiresAt: "2026-09-22T00:00:00Z", replayed: false });
    expect(JSON.stringify(result)).not.toContain("replacement-secret");
  });

  it("redacts transport errors for every guest RPC", async () => {
    const rawError = { message: `failure: ${request.guestToken} ${request.joinCode}` };
    const rpc = jest.fn(() => ({
      error: rawError,
      overrideTypes: jest.fn().mockResolvedValue({ data: null, error: rawError }),
    }));
    const guest = createGuestRoomRpcClient({ functions: { invoke: rpc } } as never);
    const calls = [
      () => guest.joinRoomAsGuest(request),
      () => guest.getGuestRoomSnapshot(request.guestToken),
      () => guest.leaveRoomAsGuest(request.guestToken),
      () => guest.rotateGuestRoomGrant(request.guestToken, "replacement-secret", "00000000-0000-4000-8000-000000000001"),
      () => guest.setMyRoomPicksAsGuest(request.guestToken, []),
      () => guest.changeManualScoreAsGuest({ guestToken: request.guestToken, matchId: "match-1", team: "home" as const, deltaGoals: 1 as const, idempotencyKey: "key-1" }),
      () => guest.changeParticipantDrinkAsGuest({ guestToken: request.guestToken, participantId: "guest-1", deltaHalfDrinks: 1 as const, idempotencyKey: "key-2" }),
    ];
    for (const invoke of calls) {
      await invoke().then(() => {
        throw new Error("guest RPC unexpectedly succeeded");
      }, error => {
        expect(String(error)).not.toContain(request.guestToken);
        expect(String(error)).not.toContain(request.joinCode);
        expect(String(error)).toMatch(/unknown_error|could not accept/);
      });
    }
  });
});
